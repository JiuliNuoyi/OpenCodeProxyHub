import { createClient, type RedisClientType } from "redis";

export interface LimitDecision {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

export interface RateLimitConfig {
  globalRequestsPerMinute: number;
  apiKeyRequestsPerMinute: number;
  apiKeyMaxConcurrentRequests: number;
  apiKeyMaxConcurrentStreams: number;
}

export interface ApiKeyLimitOverride {
  requestsPerMinute?: number;
  maxConcurrentRequests?: number;
  maxConcurrentStreams?: number;
}

export interface AsyncLimiter {
  acquire(keyId: string, stream: boolean, override?: ApiKeyLimitOverride): Promise<LimitDecision>;
  release(keyId: string, stream: boolean): Promise<void>;
  snapshot(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

interface WindowCounter {
  windowStart: number;
  count: number;
}

export class InMemoryLimiter implements AsyncLimiter {
  readonly type = "memory";
  private globalCounter: WindowCounter = { windowStart: Date.now(), count: 0 };
  private readonly keyCounters = new Map<string, WindowCounter>();
  private readonly keyConcurrency = new Map<string, number>();
  private readonly streamConcurrency = new Map<string, number>();

  constructor(private readonly config: RateLimitConfig) {}

  async acquire(keyId: string, stream: boolean, override: ApiKeyLimitOverride = {}): Promise<LimitDecision> {
    const keyRequestsPerMinute = override.requestsPerMinute ?? this.config.apiKeyRequestsPerMinute;
    const maxConcurrentRequests = override.maxConcurrentRequests ?? this.config.apiKeyMaxConcurrentRequests;
    const maxConcurrentStreams = override.maxConcurrentStreams ?? this.config.apiKeyMaxConcurrentStreams;
    const keyCounter = this.keyCounters.get(keyId) || { windowStart: Date.now(), count: 0 };
    this.keyCounters.set(keyId, keyCounter);

    const globalDecision = this.checkWindow(this.globalCounter, this.config.globalRequestsPerMinute, "全局每分钟请求数已达到上限");
    if (!globalDecision.allowed) return globalDecision;

    const keyDecision = this.checkWindow(keyCounter, keyRequestsPerMinute, "API key 每分钟请求数已达到上限");
    if (!keyDecision.allowed) return keyDecision;

    const current = this.keyConcurrency.get(keyId) || 0;
    if (maxConcurrentRequests > 0 && current >= maxConcurrentRequests) {
      return { allowed: false, reason: "API key 并发请求数已达到上限", retryAfterSeconds: 10 };
    }

    if (stream) {
      const streams = this.streamConcurrency.get(keyId) || 0;
      if (maxConcurrentStreams > 0 && streams >= maxConcurrentStreams) {
        return { allowed: false, reason: "API key 流式并发数已达到上限", retryAfterSeconds: 10 };
      }
      this.streamConcurrency.set(keyId, streams + 1);
    }

    this.globalCounter.count += 1;
    keyCounter.count += 1;
    this.keyConcurrency.set(keyId, current + 1);
    return { allowed: true };
  }

  async release(keyId: string, stream: boolean): Promise<void> {
    this.keyConcurrency.set(keyId, Math.max(0, (this.keyConcurrency.get(keyId) || 0) - 1));
    if (stream) {
      this.streamConcurrency.set(keyId, Math.max(0, (this.streamConcurrency.get(keyId) || 0) - 1));
    }
  }

  async snapshot(): Promise<Record<string, unknown>> {
    return {
      type: this.type,
      globalRequestsCurrentWindow: this.globalCounter.count,
      keyConcurrency: Object.fromEntries(this.keyConcurrency),
      streamConcurrency: Object.fromEntries(this.streamConcurrency),
    };
  }

  async close(): Promise<void> {}

  private checkWindow(counter: WindowCounter, limit: number, reason: string): LimitDecision {
    if (limit <= 0) return { allowed: true };
    const now = Date.now();
    if (now - counter.windowStart >= 60_000) {
      counter.windowStart = now;
      counter.count = 0;
    }
    if (counter.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((60_000 - (now - counter.windowStart)) / 1000));
      return { allowed: false, reason, retryAfterSeconds };
    }
    return { allowed: true };
  }
}

const ACQUIRE_SCRIPT = `
local globalRpm = tonumber(ARGV[1])
local keyRpm = tonumber(ARGV[2])
local maxConcurrent = tonumber(ARGV[3])
local maxStreams = tonumber(ARGV[4])
local isStream = ARGV[5] == "1"

if globalRpm > 0 then
  local current = tonumber(redis.call("GET", KEYS[1]) or "0")
  if current >= globalRpm then
    return {0, "全局每分钟请求数已达到上限", redis.call("PTTL", KEYS[1])}
  end
end

if keyRpm > 0 then
  local current = tonumber(redis.call("GET", KEYS[2]) or "0")
  if current >= keyRpm then
    return {0, "API key 每分钟请求数已达到上限", redis.call("PTTL", KEYS[2])}
  end
end

if maxConcurrent > 0 then
  local current = tonumber(redis.call("GET", KEYS[3]) or "0")
  if current >= maxConcurrent then
    return {0, "API key 并发请求数已达到上限", 10000}
  end
end

if isStream and maxStreams > 0 then
  local current = tonumber(redis.call("GET", KEYS[4]) or "0")
  if current >= maxStreams then
    return {0, "API key 流式并发数已达到上限", 10000}
  end
end

if globalRpm > 0 then
  local value = redis.call("INCR", KEYS[1])
  if value == 1 then redis.call("PEXPIRE", KEYS[1], 60000) end
end

if keyRpm > 0 then
  local value = redis.call("INCR", KEYS[2])
  if value == 1 then redis.call("PEXPIRE", KEYS[2], 60000) end
end

redis.call("INCR", KEYS[3])
redis.call("PEXPIRE", KEYS[3], 86400000)
if isStream then
  redis.call("INCR", KEYS[4])
  redis.call("PEXPIRE", KEYS[4], 86400000)
end

return {1, "", 0}
`;

export class RedisLimiter implements AsyncLimiter {
  readonly type = "redis";
  private readonly client: RedisClientType;

  constructor(
    redisUrl: string,
    private readonly config: RateLimitConfig,
    private readonly prefix = "opencode-proxy-hub:limit",
  ) {
    this.client = createClient({ url: redisUrl });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async acquire(keyId: string, stream: boolean, override: ApiKeyLimitOverride = {}): Promise<LimitDecision> {
    const result = await this.client.eval(ACQUIRE_SCRIPT, {
      keys: [this.key("global:rpm"), this.key(`key:${keyId}:rpm`), this.key(`key:${keyId}:concurrent`), this.key(`key:${keyId}:streams`)],
      arguments: [
        String(this.config.globalRequestsPerMinute),
        String(override.requestsPerMinute ?? this.config.apiKeyRequestsPerMinute),
        String(override.maxConcurrentRequests ?? this.config.apiKeyMaxConcurrentRequests),
        String(override.maxConcurrentStreams ?? this.config.apiKeyMaxConcurrentStreams),
        stream ? "1" : "0",
      ],
    });
    const [allowed, reason, retryAfterMs] = result as [number, string, number];
    if (allowed === 1) return { allowed: true };
    return {
      allowed: false,
      reason,
      retryAfterSeconds: Math.max(1, Math.ceil(Math.max(0, retryAfterMs) / 1000)),
    };
  }

  async release(keyId: string, stream: boolean): Promise<void> {
    const multi = this.client.multi().decr(this.key(`key:${keyId}:concurrent`));
    if (stream) multi.decr(this.key(`key:${keyId}:streams`));
    await multi.exec();
    await this.clampNonNegative(this.key(`key:${keyId}:concurrent`));
    if (stream) await this.clampNonNegative(this.key(`key:${keyId}:streams`));
  }

  async snapshot(): Promise<Record<string, unknown>> {
    return {
      type: this.type,
      globalRequestsCurrentWindow: Number(await this.client.get(this.key("global:rpm")) || 0),
    };
  }

  async close(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }

  private key(name: string): string {
    return `${this.prefix}:${name}`;
  }

  private async clampNonNegative(key: string): Promise<void> {
    const current = Number(await this.client.get(key) || 0);
    if (current < 0) await this.client.set(key, "0", { EX: 86400 });
  }
}

export const createLimiter = async (config: RateLimitConfig, redisUrl: string, prefix?: string): Promise<AsyncLimiter> => {
  if (!redisUrl) return new InMemoryLimiter(config);
  const limiter = new RedisLimiter(redisUrl, config, prefix);
  await limiter.connect();
  return limiter;
};
