import { buildApp } from "./app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const { app, keyStore } = await buildApp(config);

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info({ host: config.host, port: config.port }, "opencode_proxy_hub_started");
  const createdKeys = keyStore.consumeCreatedOnLoad();
  for (const created of createdKeys) {
    app.log.warn({ name: created.name, key: created.key }, "development_api_key_created_save_this_value");
  }
  for (const key of keyStore.list()) {
    app.log.info({ name: key.name, keyPrefix: key.keyPrefix, enabled: key.enabled }, "api_key_loaded");
  }
} catch (error) {
  app.log.error(error, "failed_to_start");
  process.exit(1);
}
