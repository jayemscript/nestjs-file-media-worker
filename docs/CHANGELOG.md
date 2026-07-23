# Changelog

## Unreleased — Phase 1 local storage

- Replaced the direct S3 proof of concept with provider-agnostic file and repository contracts.
- Added secure local storage, MongoDB metadata, content-signature validation, scoped single/bulk upload, streaming download, soft deletion, recovery, and guarded permanent deletion.
- Added active-provider readiness checks, normalized errors, unit/integration/e2e coverage, CI, and operational documentation.
- Added opt-in short-lived local transfer authorization with mandatory BFF API-key issuance, HMAC-scoped Bearer tokens, atomic replay protection, TTL cleanup, and authorized browser upload/download routes.
- Removed empty provider/event/Redis placeholders and duplicated proof-of-concept helpers.

Breaking changes: `POST /upload` was removed; clients now use `/files` with `x-app-id`. MongoDB and `HARD_DELETE_ADMIN_KEY` are required at startup.
