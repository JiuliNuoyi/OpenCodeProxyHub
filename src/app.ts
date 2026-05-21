import cors from "@fastify/cors";
import Fastify from "fastify";
import type { AppConfig } from "./config/env.js";
import { ApiKeyStore } from "./auth/apiKeys.js";
import { SessionStore } from "./sessions/sessionStore.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerModelRoutes } from "./routes/models.js";
import { registerOpenAIRoutes } from "./routes/openai.js";
import { registerAnthropicRoutes } from "./routes/anthropic.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerWebRoutes } from "./routes/web.js";
import { ModelConfigStore } from "./models/catalog.js";
import { SettingsStore } from "./settings/settingsStore.js";
import { ProxyPoolStore } from "./proxy/proxyPool.js";
import { createLimiter } from "./rateLimit/limiter.js";
import { RequestTracker } from "./runtime/requestTracker.js";
import { MetricsStore, registerMetricsHooks } from "./observability/metrics.js";

export const buildApp = async (config: AppConfig) => {
  const settingsStore = new SettingsStore(config.settingsFile, { upstreamTimeoutMs: config.upstreamTimeoutMs });
  settingsStore.load();
  const settings = settingsStore.get();

  const app = Fastify({ logger: true, bodyLimit: settings.requestBodyLimitBytes });
  const metrics = new MetricsStore();
  registerMetricsHooks(app, metrics);
  await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  });

  const keyStore = new ApiKeyStore(config.keysFile, config.storePlaintextApiKeys);
  keyStore.load();
  const modelStore = new ModelConfigStore(config.modelsFile);
  modelStore.load();
  const proxyPool = new ProxyPoolStore(config.proxiesFile, config.outboundPreProxyEnabled ? config.outboundPreProxyUrl : "", config.requireProxy);
  proxyPool.load();
  const sessions = new SessionStore();
  const requestTracker = new RequestTracker();
  const limiter = await createLimiter({
    globalRequestsPerMinute: config.globalRequestsPerMinute,
    apiKeyRequestsPerMinute: config.apiKeyRequestsPerMinute,
    apiKeyMaxConcurrentRequests: config.apiKeyMaxConcurrentRequests,
    apiKeyMaxConcurrentStreams: config.apiKeyMaxConcurrentStreams,
  }, config.redisUrl, config.redisKeyPrefix);
  app.log.info({ limiter: await limiter.snapshot() }, "limiter_ready");
  app.addHook("onClose", async () => {
    const drained = await requestTracker.drain(config.shutdownDrainTimeoutMs);
    if (!drained) app.log.warn({ runtime: requestTracker.snapshot() }, "shutdown_drain_timeout");
    await limiter.close();
  });

  await registerHealthRoutes(app, modelStore);
  await registerModelRoutes(app, modelStore);
  await registerAdminRoutes(app, config, keyStore, modelStore, settingsStore, proxyPool, limiter, requestTracker, metrics);
  await registerOpenAIRoutes(app, config, keyStore, modelStore, sessions, proxyPool, limiter, requestTracker, metrics);
  await registerAnthropicRoutes(app, config, keyStore, modelStore, sessions, proxyPool, limiter, requestTracker, metrics);
  await registerWebRoutes(app);

  app.setNotFoundHandler(async (_request, reply) => {
    return reply.code(404).send({ error: { message: "Route not found", type: "not_found_error" } });
  });

  return { app, keyStore, requestTracker };
};
