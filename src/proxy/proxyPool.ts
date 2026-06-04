import crypto from "node:crypto";
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { JsonFileStore } from "../storage/jsonFile.js";
import type { SettingsStore } from "../settings/settingsStore.js";
import { HttpPreProxyToHttpAgent, HttpPreProxyToSocksAgent } from "./chainedAgent.js";

export type ProxyType = "http" | "https" | "socks5";

export interface ProxyNode {
  id: string;
  name: string;
  type: ProxyType;
  url: string;
  enabled: boolean;
  weight: number;
  maxConcurrency: number;
  currentConcurrency: number;
  dailyRequestLimit: number;
  dailyRequestCount: number;
  dailyCountDate: string;
  autoDisableWhenDailyLimitReached: boolean;
  consecutiveRateLimitCount: number;
  cooldownUntil: string | null;
  successCount: number;
  failCount: number;
  recentResults: ProxyRequestResult[];
  lastError: string | null;
  lastUsedAt: string | null;
  lastCheckedAt: string | null;
}

export interface ProxyRequestResult {
  at: string;
  ok: boolean;
  statusCode: number;
}

interface ProxyFile {
  version: 1;
  proxies: ProxyNode[];
}

export interface ProxyInput {
  name?: string;
  type?: ProxyType;
  url?: string;
  enabled?: boolean;
  weight?: number;
  maxConcurrency?: number;
  dailyRequestLimit?: number;
  autoDisableWhenDailyLimitReached?: boolean;
}

export interface ProxyLease {
  node: ProxyNode | null;
  agent?: https.Agent;
  requiredUnavailable?: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

export class ProxyPoolStore {
  private readonly store: JsonFileStore<ProxyFile>;
  private proxies: ProxyNode[] = [];

  constructor(proxiesFile: string, private readonly settingsStore: SettingsStore) {
    this.store = new JsonFileStore<ProxyFile>(proxiesFile);
  }

  load(): void {
    const data = this.store.read({ version: 1, proxies: [] });
    this.proxies = data.proxies.map((node) => this.normalizeDaily(node));
    this.persist();
  }

  list(): ProxyNode[] {
    this.resetDailyIfNeeded();
    return this.proxies.map((proxy) => ({ ...proxy }));
  }

  create(input: ProxyInput): ProxyNode {
    const node = this.buildNode(input);
    this.validateNode(node);
    this.proxies.push(node);
    this.persist();
    return { ...node };
  }

  update(id: string, input: ProxyInput): ProxyNode {
    const node = this.find(id);
    if (!node) throw new Error("Proxy not found");

    if (input.name !== undefined) node.name = input.name.trim();
    if (input.type !== undefined) node.type = input.type;
    if (input.url !== undefined) node.url = input.url.trim();
    if (input.enabled !== undefined) {
      node.enabled = input.enabled;
      if (input.enabled) {
        node.consecutiveRateLimitCount = 0;
        if (node.lastError === "Disabled after 5 consecutive 429 responses") node.lastError = null;
      }
    }
    if (input.weight !== undefined) node.weight = Math.max(1, Math.trunc(input.weight));
    if (input.maxConcurrency !== undefined) node.maxConcurrency = Math.max(1, Math.trunc(input.maxConcurrency));
    if (input.dailyRequestLimit !== undefined) node.dailyRequestLimit = Math.max(0, Math.trunc(input.dailyRequestLimit));
    if (input.autoDisableWhenDailyLimitReached !== undefined) node.autoDisableWhenDailyLimitReached = input.autoDisableWhenDailyLimitReached;

    this.validateNode(node);
    this.persist();
    return { ...node };
  }

  delete(id: string): boolean {
    const before = this.proxies.length;
    this.proxies = this.proxies.filter((node) => node.id !== id);
    if (this.proxies.length === before) return false;
    this.persist();
    return true;
  }

  acquire(): ProxyLease {
    this.resetDailyIfNeeded();
    const now = Date.now();
    const candidates = this.proxies
      .filter((node) => node.enabled)
      .filter((node) => !node.cooldownUntil || Date.parse(node.cooldownUntil) <= now)
      .filter((node) => node.dailyRequestLimit === 0 || node.dailyRequestCount < node.dailyRequestLimit)
      .filter((node) => node.currentConcurrency < node.maxConcurrency)
      .sort((a, b) => b.weight - a.weight);

    const node = candidates[0];
    if (!node) return { node: null, requiredUnavailable: this.settingsStore.get().proxyMode === "required" };

    node.currentConcurrency += 1;
    node.dailyRequestCount += 1;
    node.lastUsedAt = new Date().toISOString();
    this.disableIfDailyLimitReached(node);
    this.persist();

    return { node: { ...node }, agent: this.createAgent(node) };
  }

  release(id: string): void {
    const node = this.find(id);
    if (!node) return;
    node.currentConcurrency = Math.max(0, node.currentConcurrency - 1);
    this.persist();
  }

  markSuccess(id: string): void {
    const node = this.find(id);
    if (!node) return;
    node.successCount += 1;
    node.consecutiveRateLimitCount = 0;
    this.recordResult(node, true, 200);
    node.lastError = null;
    node.lastCheckedAt = new Date().toISOString();
    this.release(id);
  }

  markFailure(id: string, error: string, options: { statusCode?: number; cooldownMs?: number } = {}): void {
    const node = this.find(id);
    if (!node) return;
    node.failCount += 1;
    this.recordResult(node, false, options.statusCode || 502);
    node.lastError = error;
    node.lastCheckedAt = new Date().toISOString();
    if (options.statusCode === 429) {
      node.consecutiveRateLimitCount += 1;
      if (node.consecutiveRateLimitCount >= 5) {
        node.enabled = false;
        node.cooldownUntil = null;
        node.lastError = "Disabled after 5 consecutive 429 responses";
      }
    } else {
      node.cooldownUntil = new Date(Date.now() + (options.cooldownMs ?? 5 * 60 * 1000)).toISOString();
    }
    this.release(id);
  }

  async test(id: string): Promise<ProxyNode> {
    const node = this.find(id);
    if (!node) throw new Error("Proxy not found");
    this.validateNode(node);

    await new Promise<void>((resolve, reject) => {
      const req = https.get("https://opencode.ai/", { agent: this.createAgent(node), timeout: 10000 }, (res) => {
        res.resume();
        res.on("end", () => resolve());
      });
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Proxy test timeout"));
      });
    });

    node.lastCheckedAt = new Date().toISOString();
    node.lastError = null;
    this.persist();
    return { ...node };
  }

  private buildNode(input: ProxyInput): ProxyNode {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      name: input.name?.trim() || "未命名代理",
      type: input.type || "http",
      url: input.url?.trim() || "",
      enabled: input.enabled ?? true,
      weight: Math.max(1, Math.trunc(input.weight || 1)),
      maxConcurrency: Math.max(1, Math.trunc(input.maxConcurrency || 10)),
      currentConcurrency: 0,
      dailyRequestLimit: Math.max(0, Math.trunc(input.dailyRequestLimit || 0)),
      dailyRequestCount: 0,
      dailyCountDate: today(),
      autoDisableWhenDailyLimitReached: input.autoDisableWhenDailyLimitReached ?? false,
      consecutiveRateLimitCount: 0,
      cooldownUntil: null,
      successCount: 0,
      failCount: 0,
      recentResults: [],
      lastError: null,
      lastUsedAt: null,
      lastCheckedAt: now,
    };
  }

  private createAgent(node: ProxyNode): https.Agent {
    const settings = this.settingsStore.get();
    const preProxyUrl = settings.outboundPreProxyEnabled ? settings.outboundPreProxyUrl : "";
    if (preProxyUrl && node.type === "socks5") return new HttpPreProxyToSocksAgent(preProxyUrl, node.url);
    if (preProxyUrl && ["http", "https"].includes(node.type)) return new HttpPreProxyToHttpAgent(preProxyUrl, node.url);
    return node.type === "socks5" ? new SocksProxyAgent(node.url) as unknown as https.Agent : new HttpsProxyAgent(node.url) as unknown as https.Agent;
  }

  private validateNode(node: ProxyNode): void {
    if (!node.name.trim()) throw new Error("Proxy name is required");
    if (!node.url.trim()) throw new Error("Proxy url is required");
    if (!['http', 'https', 'socks5'].includes(node.type)) throw new Error("Unsupported proxy type");
    const parsed = new URL(node.url);
    if (node.type === "socks5" && !parsed.protocol.startsWith("socks")) throw new Error("SOCKS5 proxy url must use socks:// or socks5://");
    if (node.type !== "socks5" && !["http:", "https:"].includes(parsed.protocol)) throw new Error("HTTP proxy url must use http:// or https://");
  }

  private resetDailyIfNeeded(): void {
    const current = today();
    let changed = false;
    for (const node of this.proxies) {
      if (node.dailyCountDate === current) continue;
      node.dailyCountDate = current;
      node.dailyRequestCount = 0;
      if (node.autoDisableWhenDailyLimitReached && node.lastError === "Daily request limit reached") {
        node.enabled = true;
        node.lastError = null;
      }
      changed = true;
    }
    if (changed) this.persist();
  }

  private normalizeDaily(node: ProxyNode): ProxyNode {
    return {
      ...node,
      currentConcurrency: 0,
      dailyCountDate: node.dailyCountDate || today(),
      dailyRequestLimit: node.dailyRequestLimit || 0,
      dailyRequestCount: node.dailyRequestCount || 0,
      autoDisableWhenDailyLimitReached: Boolean(node.autoDisableWhenDailyLimitReached),
      consecutiveRateLimitCount: node.consecutiveRateLimitCount || 0,
      recentResults: node.recentResults || [],
    };
  }

  private recordResult(node: ProxyNode, ok: boolean, statusCode: number): void {
    node.recentResults = [...(node.recentResults || []), { at: new Date().toISOString(), ok, statusCode }].slice(-20);
  }

  private disableIfDailyLimitReached(node: ProxyNode): void {
    if (node.dailyRequestLimit === 0 || node.dailyRequestCount < node.dailyRequestLimit) return;
    if (!node.autoDisableWhenDailyLimitReached) return;
    node.enabled = false;
    node.lastError = "Daily request limit reached";
  }

  private find(id: string): ProxyNode | undefined {
    return this.proxies.find((node) => node.id === id);
  }

  private persist(): void {
    this.store.write({ version: 1, proxies: this.proxies });
  }
}
