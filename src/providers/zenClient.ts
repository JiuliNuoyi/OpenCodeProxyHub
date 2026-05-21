import https from "node:https";
import type { ServerResponse } from "node:http";
import { ocId } from "../utils/ids.js";
import type { AppConfig } from "../config/env.js";
import type { ZenFullResponse } from "../types/api.js";
import type { ProxyLease, ProxyPoolStore } from "../proxy/proxyPool.js";
import type { MetricsStore } from "../observability/metrics.js";

const OC_VERSION = "1.15.0";
const noProxyAvailableError = "Proxy is required but no proxy node is available";

export interface ZenRequestInput {
  model: string;
  messages: unknown[];
  stream?: boolean;
  tools?: unknown[];
  toolChoice?: unknown;
  parameters?: Record<string, unknown>;
  sessionId: string;
}

export interface ZenPreparedRequest {
  body: string;
  options: https.RequestOptions;
  lease?: ProxyLease;
}

export const prepareZenRequest = (config: AppConfig, input: ZenRequestInput, proxyPool?: ProxyPoolStore): ZenPreparedRequest => {
  const requestBody: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    stream: Boolean(input.stream),
  };
  if (input.tools?.length) requestBody.tools = input.tools;
  if (input.toolChoice) requestBody.tool_choice = input.toolChoice;
  for (const [key, value] of Object.entries(input.parameters || {})) {
    if (value !== undefined) requestBody[key] = value;
  }

  const body = JSON.stringify(requestBody);
  const requestId = ocId("msg");

  const lease = proxyPool?.acquire();
  return {
    body,
    options: {
      hostname: config.zenHost,
      port: 443,
      path: config.zenPath,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: "Bearer public",
        "User-Agent": `opencode/${OC_VERSION} ai-sdk/provider-utils/4.0.23 runtime/bun/1.3.13`,
        "x-opencode-client": "cli",
        "x-opencode-project": "global",
        "x-opencode-request": requestId,
        "x-opencode-session": input.sessionId,
      },
      ...(lease?.agent ? { agent: lease.agent } : {}),
      timeout: config.upstreamTimeoutMs,
    },
    lease,
  };
};

export const requestZenFull = (prepared: ZenPreparedRequest, proxyPool?: ProxyPoolStore, metrics?: MetricsStore): Promise<ZenFullResponse> => {
  return new Promise((resolve, reject) => {
    if (prepared.lease?.requiredUnavailable) {
      reject(new Error(noProxyAvailableError));
      return;
    }
    const started = process.hrtime.bigint();
    const durationMs = () => Number(process.hrtime.bigint() - started) / 1_000_000;
    const req = https.request(prepared.options, (zenRes) => {
      const chunks: Buffer[] = [];
      zenRes.on("data", (chunk: Buffer) => chunks.push(chunk));
      zenRes.on("end", () => {
        if (prepared.lease?.node && proxyPool) {
          if ((zenRes.statusCode || 502) === 429) proxyPool.markFailure(prepared.lease.node.id, "Upstream returned 429", { statusCode: 429 });
          else proxyPool.markSuccess(prepared.lease.node.id);
        }
        metrics?.recordUpstream({ statusCode: zenRes.statusCode || 502, durationMs: durationMs(), proxyId: prepared.lease?.node?.id });
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve({ status: zenRes.statusCode || 502, data: JSON.parse(raw), raw });
        } catch {
          resolve({ status: zenRes.statusCode || 502, data: null, raw });
        }
      });
    });

    req.on("error", (error) => {
      if (prepared.lease?.node && proxyPool) proxyPool.markFailure(prepared.lease.node.id, error.message);
      metrics?.recordUpstream({ statusCode: 502, durationMs: durationMs(), proxyId: prepared.lease?.node?.id, error: error.message });
      reject(error);
    });
    req.on("timeout", () => {
      req.destroy();
      if (prepared.lease?.node && proxyPool) proxyPool.markFailure(prepared.lease.node.id, "Upstream timeout");
      metrics?.recordUpstream({ statusCode: 504, durationMs: durationMs(), proxyId: prepared.lease?.node?.id, error: "Upstream timeout" });
      reject(new Error("Upstream timeout"));
    });
    req.write(prepared.body);
    req.end();
  });
};

export const pipeZenOpenAIResponse = (prepared: ZenPreparedRequest, stream: boolean, res: ServerResponse, proxyPool?: ProxyPoolStore, metrics?: MetricsStore): void => {
  if (prepared.lease?.requiredUnavailable) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: noProxyAvailableError, type: "proxy_unavailable" } }));
    return;
  }
  const started = process.hrtime.bigint();
  const durationMs = () => Number(process.hrtime.bigint() - started) / 1_000_000;
  let markedFailure = false;
  const req = https.request(prepared.options, (zenRes) => {
    let firstChunk: Buffer | null = null;
    let headersSent = false;

    zenRes.on("data", (chunk: Buffer) => {
      if (!firstChunk) {
        firstChunk = chunk;
        const str = chunk.toString().trim();
        if (str.startsWith("{") && (str.includes("FreeUsageLimitError") || str.includes('"error"'))) {
          try {
            const parsed = JSON.parse(str);
            if (parsed.error || parsed.type === "error") {
              const errMsg = parsed.error?.message || parsed.message || "Rate limit exceeded";
              if (prepared.lease?.node && proxyPool) {
                proxyPool.markFailure(prepared.lease.node.id, errMsg, { statusCode: 429 });
                markedFailure = true;
              }
              if (!res.headersSent) {
                res.writeHead(429, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: { message: `${errMsg} (free model rate limit)`, type: "rate_limit_error", code: "rate_limit_exceeded" } }));
              }
              zenRes.resume();
              return;
            }
          } catch {
            // Continue with normal passthrough.
          }
        }

        headersSent = true;
        if (stream) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
          });
        } else {
          res.writeHead(zenRes.statusCode || 502, { "Content-Type": "application/json" });
        }
        res.write(firstChunk);
        return;
      }

      if (headersSent) res.write(chunk);
    });

    zenRes.on("end", () => {
      if (prepared.lease?.node && proxyPool && !markedFailure) {
        if ((zenRes.statusCode || 502) === 429) proxyPool.markFailure(prepared.lease.node.id, "Upstream returned 429", { statusCode: 429 });
        else proxyPool.markSuccess(prepared.lease.node.id);
      }
      metrics?.recordUpstream({ statusCode: zenRes.statusCode || 502, durationMs: durationMs(), proxyId: prepared.lease?.node?.id });
      if (!headersSent && !firstChunk) {
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "Empty response from upstream", type: "upstream_error" } }));
        }
        return;
      }
      if (headersSent) res.end();
    });
  });

  res.on("close", () => {
    if (!req.destroyed) req.destroy();
  });

  req.on("error", (error) => {
    if (prepared.lease?.node && proxyPool && !markedFailure) proxyPool.markFailure(prepared.lease.node.id, error.message);
    metrics?.recordUpstream({ statusCode: 502, durationMs: durationMs(), proxyId: prepared.lease?.node?.id, error: error.message });
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: `Upstream error: ${error.message}`, type: "upstream_error" } }));
    }
  });

  req.on("timeout", () => {
    req.destroy();
    if (prepared.lease?.node && proxyPool && !markedFailure) proxyPool.markFailure(prepared.lease.node.id, "Upstream timeout");
    metrics?.recordUpstream({ statusCode: 504, durationMs: durationMs(), proxyId: prepared.lease?.node?.id, error: "Upstream timeout" });
    if (!res.headersSent) {
      res.writeHead(504, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Upstream timeout", type: "timeout_error" } }));
    }
  });

  req.write(prepared.body);
  req.end();
};
