<div align="center">
  <img src="logo/logo.png" alt="Xeno.JS Logo" width="140" />

  <h1>Xeno.JS</h1>
  <p><strong>A Typescript application framework architecture for Node.js, designed for lower technical debt, and faster infrastructure migrations.</strong></p>
  <p>Build long-lived applications with explicit dependency injection, DDD, CQRS, and transport-independent business logic.</p>

  <p>
    <a href="https://www.npmjs.com/package/@xeno-js/core"><img src="https://img.shields.io/npm/v/@xeno-js/core?style=flat-square" alt="NPM Version" /></a>
    <a href="https://github.com/xeno-js/xeno-js"><img src="https://img.shields.io/badge/Powered%20by-Xeno-blueviolet?style=flat-square" alt="Powered by Xeno" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License: MIT" /></a>
    <a href="https://buymeacoffee.com/xenojs">
      <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFdd00?style=flat-square&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
    </a>
  </p>
</div>

---

## What is Xeno?

Xeno.JS is a TypeScript application architecture framework for Node.js.

It provides explicit building blocks for applications organized around:

- **Dependency Injection** with explicit service registration and lifetimes
- **Domain-Driven Design (DDD)** and domain/application boundaries
- **CQRS** with commands, queries, handlers, and composable pipelines
- **Request context** built around asynchronous execution context
- **Repositories and data sources** that keep persistence behind application
  boundaries
- **Infrastructure adapters** for databases, Redis, authentication, logging,
  resilience, and other integrations

The goal is simple: **make application architecture explicit in code.**

Xeno.JS is not tied to a specific HTTP server. Your application layer can remain
independent from the transport that delivers a request.

---

## Why Xeno?

### 01 — Explicit Architecture

**Your dependency graph is code.**

Xeno.JS does not require decorators, runtime scanning, or implicit dependency
discovery. Services are registered explicitly, and their lifetimes are visible
at the composition root.

```typescript
services.addScoped('USER_REPOSITORY', (container) => {
  return new UserRepository(
    container.resolve('USER_DATA_SOURCE'),
    container.resolve('USER_MAPPER'),
  )
})
```

This makes the composition of the application easier to inspect, test, and
reason about.

### 02 — Transport Independence

Business logic should not belong to your HTTP framework.

Xeno.JS keeps application concerns separate from delivery mechanisms, allowing
the same application architecture to be hosted behind transports such as
Fastify, Hono, Express, or other adapters.

```text
HTTP / CLI / Worker / Lambda
            |
            v
      Presentation
            |
            v
      Application
   Commands / Queries
            |
            v
         Domain
            |
            v
     Infrastructure
       DB / Redis / APIs
```

### 03 — CQRS as an Application Primitive

Commands and queries are first-class application concepts.

Pipelines can compose cross-cutting behavior around execution, such as:

- authorization
- idempotency
- concurrency control
- caching
- resilience policies
- request context

This keeps cross-cutting concerns out of individual handlers.

### 04 — Explicit Lifetimes and Request Boundaries

Xeno.JS distinguishes service lifetimes such as singleton, scoped, and transient
services.

Request-scoped dependencies are resolved inside an explicit application scope,
while request metadata can be carried through asynchronous execution using
`AsyncLocalStorage`.

Database transaction state is scoped to the same application boundary, allowing
`UnitOfWork` and `DbContext` to operate against the transaction associated with
the current scope.

### 05 — Infrastructure Stays Outside the Domain

Database clients, Redis, HTTP clients, authentication providers, loggers, and
other infrastructure integrations are composed at the edge of the application.

Your domain and application code can depend on contracts instead of concrete
infrastructure.

---

## Architecture

A typical Xeno.JS application can be organized like this:

```text
+------------------------------------------+
|                Presentation              |
|       HTTP / CLI / Workers / Lambda      |
+---------------------+--------------------+
                      |
                      v
+------------------------------------------+
|                Application               |
|   Commands / Queries / Handlers / Pipes |
+---------------------+--------------------+
                      |
                      v
+------------------------------------------+
|                  Domain                  |
|       Entities / Policies / Rules        |
+---------------------+--------------------+
                      |
                      v
+------------------------------------------+
|               Infrastructure             |
|       DB / Redis / APIs / Auth / Logs   |
+------------------------------------------+
```

Xeno's core is focused on composition and application architecture.
Infrastructure capabilities can be enabled only when they are needed.

---

## Core Concepts

| Concept            | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `AppBuilder`       | Composition root for assembling an application            |
| `ServiceContainer` | Explicit dependency injection and service lifetimes       |
| `CQRS`             | Commands, queries, handlers, and mediator-based execution |
| `Pipelines`        | Cross-cutting behavior around application execution       |
| `Request Context`  | Request metadata across asynchronous execution            |
| `Repository`       | Application-facing persistence abstraction                |
| `DataSource`       | Infrastructure-facing data access implementation          |
| `Module`           | Explicit registration of related capabilities             |
| `Result`           | Typed success/failure flow for application operations     |

---

## Installation

```bash
npm install @xeno-js/core
```

Install only the integrations your application uses. Xeno.JS exposes optional
infrastructure dependencies for capabilities such as databases, Redis, logging,
resilience, and authentication.

For example:

```bash
npm install zod pino cockatiel drizzle-orm
```

---

## A Small Example

The composition root is explicit:

```typescript
// src/bootstrap.ts
import { AppBuilder } from '@xeno-js/core'

const app = new AppBuilder().addServices((services) => {
  services.addScoped('USER_REPOSITORY', (container) => {
    return new UserRepository(container.resolve('USER_DATA_SOURCE'))
  })

  services.addScoped('FIND_USER_HANDLER', (container) => {
    return new FindUserHandler(container.resolve('USER_REPOSITORY'))
  })

  services.addTransient('FIND_USER_CONTROLLER', (c) => {
    return new FindUserController(
      c.resolve(TOKENS.REQUEST_CONTEXT),
      c.resolve(TOKENS.MEDIATOR),
    )
  })
})

await app.build()
```

The transport remains outside the application composition:

> ⚠️ **Implementation note: Example using Fastify** The following snippet uses
> **Fastify** solely for demonstration purposes to illustrate the transport
> layer. Thanks to the framework's agnostic architecture, the underlying logic
> (`container` and `handler`) remains unchanged regardless of the chosen HTTP
> system (e.g., Express, Koa) or interface (CLI, gRPC).

```typescript
import Fastify from 'fastify'
import { app } from './bootstrap'

const fastify = Fastify({ logger: true })

fastify.get('/users/:id', async (req, reply) => {
  const action = async () => {
    const controller = ContainerUtils.resolveServiceScoped(
      'FIND_USER_CONTROLLER',
      app,
    )
    return await controller.handle()
  }

  const result = await ContainerUtils.runExecute(req, reply, app, action)

  return reply.send(result)
})
```

The HTTP adapter is responsible for HTTP. The application handler is responsible
for the use case.

---

## CQRS & Pipelines

Cross-cutting behavior can be composed around commands and queries:

```typescript
.addPipeline((config) => {
  config.authorization.policies = {
    FIND_USER_QUERY_HANDLER: {
      roles: ['admin'],
      permissions: ['read'],
    },
  }

  config.commandBus.idempotency = {
    lockTtlSeconds: 30,
    processedTtlSeconds: 60,
  }

  config.commandBus.concurrency = {
    delayConfig: {
      baseDelayMs: 100,
      maxJitterMs: 500,
    },
    maxRetries: 3,
  }

  config.queryBus.isEnabled = true
})
```

The exact pipeline configuration depends on the integrations enabled by your
application.

---

## Infrastructure & Integrations

Xeno.JS Core can be composed with infrastructure such as:

- **Database:** Drizzle ORM, PostgreSQL, LibSQL
- **Cache / distributed coordination:** Redis
- **Authentication:** Supabase integrations and custom strategies
- **HTTP clients:** Axios
- **Resilience:** Cockatiel
- **Logging:** Console, Pino, Sentry, or custom loggers
- **Validation:** Zod

These integrations are opt-in rather than mandatory parts of the application
architecture.

---

## CLI

Use the official CLI to scaffold a Xeno.JS application:

```bash
npm install @xeno-js/cli
xeno-js new my-xeno-app --core
```

See the [CLI documentation](https://www.xeno-js.it/cli/overview).

---

## Documentation

The documentation hub contains the architecture and integration guides:

**[xeno-js.it](https://www.xeno-js.it/docs/introduction)**

Recommended starting points:

- [Introduction](https://www.xeno-js.it/docs/introduction)
- [Fundamentals](https://www.xeno-js.it/docs/fundamentals/overview)
- [Dependency Injection](https://www.xeno-js.it/docs/dependency-injection/service-container)
- [CQRS](https://www.xeno-js.it/docs/application/cqrs/overview)
- [Pipelines](https://www.xeno-js.it/docs/application/overview)
- [CLI](https://www.xeno-js.it/docs/cli/overview)

---

## Ecosystem

Xeno.JS is designed as an ecosystem rather than a single monolithic package:

| Package           | Role                                      |
| ----------------- | ----------------------------------------- |
| `@xeno-js/core`   | Application architecture and backend core |
| `@xeno-js/shared` | Shared contracts and types                |
| `@xeno-js/vue`    | Vue integration                           |
| `@xeno-js/cli`    | Project scaffolding and developer tooling |

---

## What Xeno.JS Is Not

Xeno.JS is not primarily an HTTP framework.

If you are looking for a framework centered on routing, controllers, middleware,
and server lifecycle, there are excellent options already available in the
Node.js ecosystem.

Xeno.JS focuses on the layer above transport:

> **How should a TypeScript application be structured so that its business
> logic, dependencies, and infrastructure boundaries remain explicit as the
> application grows?**

---

## Production Considerations

Xeno.JS provides architectural primitives, but application correctness still
depends on how those primitives are composed.

Before deploying an application, test the behaviors that matter to your
workload, especially:

- request and transaction isolation
- service lifetime boundaries
- authorization policies
- idempotency semantics
- concurrency behavior
- cache consistency
- failure and retry behavior
- trusted proxy / client IP configuration
- database transaction boundaries

The framework is designed to make these boundaries explicit rather than hide
them behind conventions.

---

## Contributing

Contributions are welcome.

Development happens from feature branches targeting `develop`.

```bash
git checkout develop
git pull origin develop
git checkout -b feat/your-feature

npm install
npm run check
```

We use Conventional Commits:

```bash
feat(scope): add new feature
fix(scope): resolve bug
chore(scope): update dependencies
```

Before opening a pull request, run:

```bash
npm run check
```

| Command                 | Description              |
| ----------------------- | ------------------------ |
| `npm run build`         | Build the package        |
| `npm run typecheck`     | TypeScript type checking |
| `npm run lint`          | ESLint                   |
| `npm run format:check`  | Prettier validation      |
| `npm run test`          | Vitest test suite        |
| `npm run test:coverage` | Test suite with coverage |

---

## Support

If Xeno.JS is useful to you, you can support the project through the community
and sponsorship channels documented on the website:

**[Support Xeno](https://www.xeno-js.it/support-us)**

---

## License

Copyright (c) 2026 Xeno.

Licensed under the [MIT License](LICENSE).
