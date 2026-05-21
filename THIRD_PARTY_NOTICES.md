# Third Party Notices

## opencode-free-proxy

OpenCodeProxyHub is derived from and substantially inspired by `opencode-free-proxy`.

Source:

```text
https://github.com/bigdata2211it-web/opencode-free-proxy
```

The original project declares the MIT License in its `package.json` and `README.md`.

Original package metadata:

```json
{
  "name": "opencode-free-proxy",
  "version": "0.9.0",
  "license": "MIT"
}
```

The original project provides the core idea and compatibility behavior for exposing OpenCode free models through OpenAI-compatible and Anthropic-compatible API endpoints.

OpenCodeProxyHub has been substantially rewritten and expanded, but keeps this attribution to preserve the original MIT notice and project credit.

## Runtime And Build Dependencies

OpenCodeProxyHub uses Node.js, TypeScript, Fastify, Redis client libraries, React, Vite, proxy agent libraries, and related transitive dependencies.

The dependency license review performed during development found the dependency set to be composed of permissive licenses compatible with MIT distribution, including:

- MIT
- ISC
- BSD-2-Clause / BSD-3-Clause
- Apache-2.0

No GPL, AGPL, or LGPL dependency was identified in the application dependency set during this review.

If you redistribute a built Docker image, also review and preserve notices for the base image and operating system packages included by `node:20-alpine`.

## Service And Trademark Notice

OpenCodeProxyHub is not affiliated with OpenCode or any upstream service provider.

This project's open source license does not grant rights to use third-party services, APIs, trademarks, or infrastructure beyond their own terms.
