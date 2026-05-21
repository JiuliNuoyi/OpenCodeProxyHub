# OpenCodeProxyHub

OpenCodeProxyHub is an independent AI API gateway that exposes OpenCode free models through OpenAI- and Anthropic-compatible endpoints.

The initial implementation focuses on a maintainable TypeScript + Fastify refactor of the lightweight proxy behavior. The long-term direction is a Web UI driven gateway with outbound proxy/IP pool support, rate limiting, observability, and high-concurrency deployment support.

OpenCodeProxyHub is licensed under the MIT License. It is derived from and substantially inspired by [`opencode-free-proxy`](https://github.com/bigdata2211it-web/opencode-free-proxy), which also declares the MIT License.

OpenCodeProxyHub is independent and is not affiliated with OpenCode, `opencode-free-proxy`, or any upstream service provider.

## Tech Stack

- Runtime: Node.js 20+
- Backend: TypeScript, Fastify
- Frontend: React, Vite, lucide-react
- Storage: JSON files for local persistent configuration
- Optional runtime state: Redis
- Proxy support: HTTP, HTTPS, SOCKS5, and chained pre-proxy routing
- Deployment: Docker and Docker Compose
- License: MIT

## Current Features

- OpenAI-compatible `POST /v1/chat/completions`
- Anthropic-compatible `POST /v1/messages`
- `GET /v1/models`
- `GET /health`
- Local API key file generation for development
- Hashed API key storage with automatic migration from the legacy `{name: key}` format
- Admin API key management endpoints
- Persistent model configuration
- Persistent system settings
- Built-in Web UI served at `/app`
- Streaming passthrough for OpenAI-compatible clients
- Basic OpenAI SSE to Anthropic SSE conversion

## Quick Start

```bash
npm install
npm --prefix web install
npm run build:all
npm run dev
```

The server defaults to:

```text
http://localhost:6446
```

The Web UI is available after `npm run build:web` or `npm run build:all`:

```text
http://localhost:6446/app
```

The Web UI currently supports:

- saving an admin token or development API key in browser local storage
- listing API keys
- creating API keys and showing the plaintext value once
- enabling/disabling and deleting API keys
- listing models
- enabling/disabling models
- viewing and updating basic system settings

API keys are generated in `api-keys.json` on first start. The plaintext value is shown once in the startup log and only a SHA-256 hash is persisted.

If `STORE_PLAINTEXT_API_KEYS=true` is enabled, newly created API keys are also stored in recoverable plaintext form so the Web UI can copy them later. Protect `api-keys.json` carefully when this mode is enabled. Existing keys created before this mode was enabled cannot be recovered.

Proxy pool nodes normally connect directly to their configured proxy URL. For environments where a proxy provider cannot be reached directly, enable the optional outbound pre-proxy:

```text
OUTBOUND_PRE_PROXY_ENABLED=true
OUTBOUND_PRE_PROXY_URL=http://host.docker.internal:7897
```

The chained-proxy mode supports HTTP/HTTPS pre-proxy to `http`, `https`, and `socks5` proxy-pool nodes.

Proxy selection uses priority fill: the gateway keeps using the first available enabled node by weight/order until it is unavailable, at its concurrency/daily limit, or disabled. A node is automatically disabled after 5 consecutive upstream 429 responses and must be manually re-enabled. Set `REQUIRE_PROXY=true` to fail requests instead of falling back to direct upstream when no proxy node is available.

## Docker Deployment

Docker Compose deployment is available for production-style runs:

```bash
cp .env.docker.example .env.docker
docker compose up -d --build
```

Set a strong `ADMIN_PASSWORD` in `.env.docker` before exposing the service. Runtime JSON files are stored in `./data` and Redis counters are stored in the `redis-data` Docker volume.

See `DEPLOYMENT.md` for health checks, smoke tests, backups, reverse proxy notes, and upgrade steps.

The key file uses this structure:

```json
{
  "version": 1,
  "keys": [
    {
      "id": "...",
      "name": "admin",
      "keyHash": "...",
      "keyPrefix": "oc-1234...abcd",
      "enabled": true,
      "createdAt": "...",
      "lastUsedAt": null
    }
  ]
}
```

Legacy key files in the original format are migrated automatically:

```json
{
  "admin": "oc-plain-text-key"
}
```

## Environment

Copy `.env.example` to `.env` and adjust values as needed.

```text
PROXY_PORT=6446
PROXY_HOST=0.0.0.0
KEYS_FILE=./api-keys.json
MODELS_FILE=./models.json
SETTINGS_FILE=./settings.json
ADMIN_PASSWORD=admin
ZEN_HOST=opencode.ai
ZEN_PATH=/zen/v1/chat/completions
UPSTREAM_TIMEOUT_MS=120000
```

Admin endpoints require the console password. The default is `admin`; change `ADMIN_PASSWORD` before exposing the service.

## Admin API

```text
GET    /admin/api-keys
POST   /admin/api-keys
PATCH  /admin/api-keys/:id
DELETE /admin/api-keys/:id
GET    /admin/models
PUT    /admin/models/:id
DELETE /admin/models/:id
GET    /admin/settings
PATCH  /admin/settings
```

Create a key:

```bash
curl -X POST http://127.0.0.1:6446/admin/api-keys \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"name":"default-user"}'
```

The plaintext key is returned once in the create response and only its hash is persisted.

Disable a model:

```bash
curl -X PUT http://127.0.0.1:6446/admin/models/qwen3.6-plus-free \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'
```

Update system settings:

```bash
curl -X PATCH http://127.0.0.1:6446/admin/settings \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"defaultStream":false,"logPrompts":false}'
```

Persistent local development files:

```text
api-keys.json
models.json
settings.json
proxies.json
```

These files are ignored by Git.

## Roadmap

See `DEVELOPMENT_LOG.md` for the staged implementation plan.

## License

OpenCodeProxyHub is released under the MIT License. See [`LICENSE`](./LICENSE).

Attribution and third-party notices are maintained in:

- [`NOTICE`](./NOTICE)
- [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)

The MIT License applies to this project's source code. It does not grant rights to use third-party services, APIs, trademarks, model providers, proxy providers, or infrastructure beyond their own terms.

## Credits And Attribution

This project is derived from and substantially inspired by `opencode-free-proxy`:

```text
https://github.com/bigdata2211it-web/opencode-free-proxy
```

The original project declares the MIT License in its `package.json` and `README.md`.

OpenCodeProxyHub reimplements and extends the original project's core compatibility behavior, including OpenAI/Anthropic-compatible endpoints, OpenCode Zen API forwarding, `x-opencode-*` upstream headers, model compatibility behavior, and message conversion concepts.

OpenCodeProxyHub has since been substantially rewritten and expanded with TypeScript/Fastify architecture, a React Web UI, API key management, proxy pool and chained proxy support, rate limiting, observability, and Docker deployment.

OpenCodeProxyHub is independent and is not affiliated with OpenCode, `opencode-free-proxy`, or any upstream service provider.
