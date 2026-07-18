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
- Error responses do not expose database errors, OS errors, URIs, credentials, or absolute paths.

## Deployment responsibilities

- Replace development `x-app-id` trust with authenticated application identity before production.
- Generate a long random `HARD_DELETE_ADMIN_KEY`, store it in a secret manager, rotate it, and never log it.
- Restrict MongoDB network access, use least-privilege credentials, TLS, backups, and monitoring.
- Keep the local storage root outside publicly served directories and apply least-privilege filesystem permissions.
- Configure realistic upload limits for available memory. Phase 1 buffers uploads; large cloud uploads should use the authenticated Phase 2 presigned workflow.
- Add malware scanning/quarantine when accepting untrusted public uploads. Magic-byte validation is not malware detection.
- Apply gateway rate limits and request timeouts.

Never commit `.env`, `upload/`, Atlas credentials, admin keys, test data, or generated storage files.
