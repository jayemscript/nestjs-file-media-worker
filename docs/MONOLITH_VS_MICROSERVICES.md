# Monolith vs. Microservices

## Recommended default

Start with a modular monolith unless independent deployment, team ownership, reliability isolation, or scaling requirements justify a distributed system. A well-structured monolith can preserve domain boundaries without paying the operational cost of network calls, distributed tracing, message delivery, and cross-service data consistency.

Choose microservices because a boundary needs operational independence—not simply because the application has several business modules.

| Prefer a modular monolith when | Consider microservices when |
| --- | --- |
| One team owns most of the system | Different teams independently own clear domains |
| Modules normally deploy together | Domains require independent release schedules |
| Traffic and scaling needs are similar | One capability has materially different scaling needs |
| Local transactions simplify important workflows | Isolation is worth eventual consistency and compensation |
| Operational simplicity is important | The organization can support gateways, observability, retries, queues, and service security |

Microservices should usually be extracted from proven module boundaries. Splitting too early often replaces simple function calls with a distributed monolith containing synchronous, tightly coupled services.

## Communication in a monolith

### Calls inside the same NestJS application

Do not use HTTP to call another module inside the same process. Export the application service from its NestJS module and inject it through an explicit contract or provider token.

```text
AdminController -> AdminApplicationService -> FilesService
```

This keeps calls typed, avoids unnecessary serialization and network failure modes, and makes transactions and tests simpler. In this repository, `FilesModule` exports `FilesService` specifically for this use case.

### Calls from a Next.js client

A browser-based Next.js page must use HTTP to reach the backend. Native `fetch` is normally sufficient:

```ts
const response = await fetch(`${apiBaseUrl}/files/${fileId}`, {
  headers: {
    'x-app-id': appId,
  },
});
```

Use Axios when its interceptors, shared instances, upload progress support, or an existing Axios-based client layer provides concrete value. Axios is optional rather than an architectural requirement.

Next.js Server Components, Server Actions, and Route Handlers execute on the server. When they hide credentials, aggregate backend calls, or shape responses for the UI, they are acting as a lightweight BFF even if they live in the same repository as the frontend.

### Calls between separately deployed monoliths

Once two applications are separate processes, the call is a remote integration regardless of whether either application is called a monolith. Native `fetch`, NestJS `HttpModule`/Axios, gRPC, or messaging can be used according to the contract. Add timeouts, bounded retries, authentication, tracing, and idempotency where appropriate.

## Communication in microservices

For a browser application, use this as the default request path:

```text
admin-portal -> admin-bff -> domain services
```

The browser should not normally call private domain services directly. The BFF is the public backend boundary for that frontend and is responsible for:

- authenticating the user and enforcing coarse-grained access;
- translating the UI request into calls to domain services;
- aggregating and shaping responses for the admin portal;
- hiding internal service addresses, versions, and service credentials;
- applying edge concerns such as rate limits and request correlation.

The BFF should not become the owner of business rules or domain data. Business invariants remain in their domain services.

### Suggested responsibilities

```text
admin-portal
  Browser UI for internal administrators

admin-bff
  Admin-facing authentication, authorization, aggregation, and response shaping

domain services
  Business rules, workflows, and data owned by a specific capability

file-media-service
  File metadata, validation, lifecycle, and storage-provider orchestration
```

An `admin-domain` service is not required to avoid every outbound call. A domain service may communicate with another service when a real cross-domain workflow requires it, preferably through an application-owned port or asynchronous event. However, synchronous service chains should be kept short.

Also consider whether “admin” is genuinely a business domain. Often it is a user role or interface over domains such as users, orders, catalog, or billing. In that case, `admin-bff` should call those capability-based services instead of placing unrelated rules into one broad `admin-domain` service.

## Should the admin portal call the file service directly?

There are two different kinds of traffic:

1. Small JSON commands and metadata.
2. Potentially large file bytes.

They should not always follow the same path.

### JSON and business operations

Use the BFF by default:

```text
admin-portal -> admin-bff -> admin/domain service
                          -> file-media-service (metadata/lifecycle)
```

This prevents the browser from receiving permanent service credentials and keeps internal topology private.

### Upload and download bytes

Avoid sending large file bodies through both the BFF and a domain service. The preferred production flow is:

```text
1. admin-portal -> admin-bff: request permission to upload/download
2. admin-bff -> file-media-service: authorize and create a short-lived operation
3. admin-portal -> file-media-service or object storage: transfer bytes directly
4. admin-portal -> admin-bff: submit the returned fileId with the business command
5. admin-bff -> domain service: persist the business relationship to fileId
```

For S3, step 3 normally uses a short-lived presigned URL. A local-storage provider can use a short-lived, narrowly scoped upload/download token issued by the file service or gateway.

The direct browser transfer is safe only when it uses short-lived user-scoped authorization, strict CORS, file limits, and ownership validation. Never embed `API_KEYS`, an admin key, AWS credentials, or another permanent service secret in the admin portal. Environment variables exposed to browser bundles are public regardless of their names.

### Current Phase 1 service

This service currently authenticates consumers using `x-api-key` and scopes files using `x-app-id`. Because a permanent API key must not be exposed in browser code, the safe current topology is:

```text
admin-portal -> admin-bff -> file-media-service
```

The BFF may proxy Phase 1 uploads and downloads while limits are small. Before using direct browser-to-service transfer in production, add short-lived operation tokens or place an authenticated gateway in front of the file service. Phase 2 presigned S3 transfers can then bypass the BFF for bytes without bypassing authorization.

## Practical decision guide

- Same NestJS process: inject the module service; do not call yourself over HTTP.
- Browser to backend: use native `fetch` by default; Axios is optional.
- Admin portal in microservices: call the admin BFF for JSON and business operations.
- BFF to services: use private authenticated service-to-service calls with timeouts and tracing.
- Large file bytes: authorize through the BFF, then transfer directly using a short-lived scoped token or presigned URL.
- Permanent service API keys: keep them server-side and never ship them to Next.js browser code.
- Domain rules: keep them in capability-based domain services, not in the BFF.
