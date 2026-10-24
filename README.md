<div align="center">
  <img src="logo/logo.png" alt="Xeno.JS Logo" width="140" />

  <h1>Xeno.JS Node</h1>
  <p><strong>A Typescript application framework architecture for Node.js, designed for lower technical debt, and faster infrastructure migrations.</strong></p>
  <p>Build long-lived applications with explicit dependency injection, DDD, CQRS, and transport-independent business logic.</p>

  <p>
    <a href="https://www.npmjs.com/package/@xeno-js/node"><img src="https://img.shields.io/npm/v/@xeno-js/node?style=flat-square" alt="NPM Version" /></a>
    <a href="https://github.com/xeno-js/node"><img src="https://img.shields.io/badge/Powered%20by-Xeno-blueviolet?style=flat-square" alt="Powered by Xeno" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License: MIT" /></a>
    <a href="https://buymeacoffee.com/xenojs">
      <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFdd00?style=flat-square&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
    </a>
  </p>
</div>

---

`@xeno-js/node` provides native HTTP server integration for the Xeno.JS ecosystem. It leverages Node's built-in `http` module to handle incoming network requests, translating native messages into framework-agnostic requests and delegating execution through core dispatchers.

## Installation

```bash
npm install @xeno-js/node

```

The package requires `@xeno-js/core` as a peer dependency.

---

## 1. Native HTTP Server Plugin Integration

**Problem.** Applications that want to avoid heavy external web frameworks still need a robust, unified mechanism to handle transport lifecycles, route matching, and request dispatching natively.

**Principle.** Transport infrastructure must remain decoupled from business logic, translating native server events into uniform application requests.

**Mechanism.** The `withNodeHttpServer` function registers an `HttpServerModule` and binds `NodeHttpServer` to the container under `TOKENS.HTTP_SERVER`. It uses `NodeHttpFactory` to spin up a native `http.createServer` instance that intercepts incoming traffic, matches routes via `ROUTE_MATCHER`, and executes requests using `HTTP_DISPATCHER`.

**Implementation:**

```ts
import { XenoAppBuilder } from '@xeno-js/core';
import { withNodeHttpServer } from '@xeno-js/node';

const app = await new XenoAppBuilder()
  .addHttpServer(withNodeHttpServer())
  .build();

await app.listen({ port: 3000, host: 'localhost' });

```

**Behavior:** When `.listen()` is invoked, `NodeHttpServer` starts the underlying Node HTTP server on the specified port and host. Incoming requests are processed by the factory's server callback, mapped via `NodeRequestMapper`, dispatched through the routing layer, and written back to the client response stream.

**Boundary:** This package handles native Node server lifecycle management, header normalization, and response serialization. It does not contain application business logic or direct database access; all requests are delegated to core domain handlers.

---

## 2. Request Mapping and Lifecycle Management

**Problem.** Native Node.js `IncomingMessage` and `ServerResponse` objects cannot be passed directly into domain handlers or core application dispatchers.

**Principle.** Framework and transport types must be strictly isolated at the edge through explicit mapping layers.

**Mechanism.** `NodeRequestMapper` normalizes headers, extracts query paths, and converts native messages into `XenoIncomingRequest` objects. It also manages safe response serialization, automatically appending default JSON headers and stringifying payloads.

**Implementation:**

The mapping flow operates internally inside the native server callback created by `NodeHttpFactory`:

```ts
// Internal mapping flow within NodeHttpFactory server instance
const incomingRequest = NodeRequestMapper.mapRequest(req);
const extendedRequest = this._adapter.adapt(incomingRequest);
const routeResult = await matchedRoute.handler({
  req: extendedRequest,
  handle: (token, input) => this._dispatcher.handle(extendedRequest, token, input),
});

NodeHttpServer.mapResponse(res, routeResult.status, routeResult.data, routeResult.headers);

```

**Behavior:** If a requested route does not match any registered pattern, it automatically responds with a standardized `404 Not Found` payload. Unhandled runtime errors are caught safely and returned as `500 Internal Server Error` responses.

**Boundary:** `NodeRequestMapper` relies strictly on Node's native HTTP stream interfaces and does not manage session persistence or application state.

---

## License

Released under the [MIT License](LICENSE).
