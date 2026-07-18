# Local Transfer Authorization Plan

## Status

Planned after the current local-storage milestone and before the S3 provider. Do not implement as part of unrelated work.

## Goal

Allow a browser to transfer file bytes directly with the file service without exposing the BFF's permanent `x-api-key`.

```text
admin-portal -> admin-bff: request permission
admin-bff -> file-media-service: create short-lived authorization
admin-portal -> file-media-service: upload/download using temporary token
```

Local transfers still pass through the file service because the filesystem has no public HTTP API. Phase 2 S3 can preserve the authorization workflow while returning a presigned S3 URL for the byte transfer.

## Proposed API

Internal endpoints called by the BFF:

```http
POST /files/authorizations/upload
POST /files/:fileId/authorizations/download
```

Browser-facing transfer endpoints:

```http
POST /files/direct-upload
GET /files/:fileId/direct-download
```

Names are provisional and should be reviewed before implementation.

## Token requirements

Each signed authorization must be:

- short-lived;
- scoped to `appId` and one operation (`upload` or `download`);
- scoped to `fileId` for downloads;
- constrained by upload size and allowed MIME types for uploads;
- cryptographically signed and validated without trusting browser headers;
- single-use where practical, using a unique token ID and replay store;
- rejected after expiration, reuse, tampering, or scope mismatch.

Permanent API keys, admin keys, filesystem paths, storage keys, and provider credentials must never be included in the browser response or token claims.

## Implementation milestones

1. Define provider-agnostic transfer-authorization contracts and normalized errors.
2. Add configuration for signing key, token lifetime, public file-service URL, and allowed origins.
3. Implement BFF-only authorization endpoints protected by the existing service API key.
4. Implement local direct-upload and direct-download routes using temporary authorization.
5. Add replay protection, rate limiting, audit-safe logging, and cleanup.
6. Test expiration, tampering, reuse, app isolation, file scope, limits, CORS, and streamed transfers.
7. Update the client/BFF integration documentation.

## S3 migration

When S3 is introduced, application authorization remains in the file service. Local and S3 keep separate transfer implementations:

- The local provider returns a short-lived URL for a file-service transfer endpoint.
- The S3 provider returns a short-lived S3 presigned URL.

Selecting `STORAGE_PROVIDER=s3` changes which transfer response is issued at runtime; it does not remove or rewrite the local implementation. Switching back to `STORAGE_PROVIDER=local` continues to use the local signed-transfer route. A provider-agnostic authorization response should expose the transfer URL, HTTP method, required temporary headers, expiration, and finalization requirement without exposing credentials or provider-internal details.

Direct-to-S3 uploads will also require a safe metadata finalization workflow, such as pending metadata followed by object verification before the file becomes active.
