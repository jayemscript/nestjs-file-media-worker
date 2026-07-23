# Security

## Implemented in Phase 1

- File operations are scoped by both validated `appId` and MongoDB `fileId`.
- Original filenames are sanitized display metadata and are never storage keys.
- Storage keys are service-generated UUID paths and cannot escape the configured root.
- Local storage rejects absolute paths, drive paths, backslashes, traversal segments, empty segments, and unsafe characters.
- File signatures must match declared MIME types and a configured allowlist.
- Multipart file/count limits and aggregate bulk limits constrain memory use.
- Downloads use safe attachment headers and stream from storage.
- Soft-deleted files are unavailable through normal reads/downloads.
- Permanent deletion requires soft deletion plus a timing-safe admin-key comparison.
- BFF-only transfer-authorization endpoints always require a registered service API key.
- Direct local transfers use short-lived HMAC-signed, operation-scoped tokens.
- Transfer token IDs are stored only as SHA-256 hashes and atomically consumed once in MongoDB.
- Upload authorizations constrain size and MIME types; download authorizations bind one application and file ID.
- Expired authorization records are cleaned through a MongoDB TTL index.
- Direct transfer attempts have a configurable per-instance IP rate limit.
- Error responses do not expose database errors, OS errors, URIs, credentials, or absolute paths.

## Deployment responsibilities

- Treat `x-app-id` only as an application identifier. Authentication must come from a service API key, BFF/user identity, gateway, or short-lived transfer token.
- Keep `TRANSFER_TOKEN_SIGNING_KEY` in a secret manager, use at least 32 random characters, and rotate it deliberately. Rotation immediately invalidates unexpired tokens.
- Keep permanent API keys in server-side BFF configuration and never include them in frontend bundles.
- Use HTTPS for every production authorization and byte-transfer request, and allow only trusted frontend origins through CORS.
- Generate a long random `HARD_DELETE_ADMIN_KEY`, store it in a secret manager, rotate it, and never log it.
- Restrict MongoDB network access, use least-privilege credentials, TLS, backups, and monitoring.
- Keep the local storage root outside publicly served directories and apply least-privilege filesystem permissions.
- Configure realistic upload limits for available memory. Phase 1 buffers uploads; large cloud uploads should use the authenticated Phase 2 presigned workflow.
- Add malware scanning/quarantine when accepting untrusted public uploads. Magic-byte validation is not malware detection.
- Apply gateway rate limits and request timeouts. The built-in direct-transfer limiter is per process and does not replace a distributed gateway limit for multiple replicas.

Never commit `.env`, `upload/`, Atlas credentials, admin keys, test data, or generated storage files.
