# API Documentation

Base URL for local development: `http://localhost:7007`.

All file endpoints require a lowercase `x-app-id` header. Phase 1 treats this header as a development identity source; production deployments must replace it with an authenticated application identity.

JSON success responses use this envelope:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2026-07-18T00:00:00.000Z"
}
```

Errors use stable codes and never expose local paths or provider errors:

```json
{
  "statusCode": 404,
  "message": "File not found",
  "error": "FILE_NOT_FOUND",
  "timestamp": "2026-07-18T00:00:00.000Z",
  "path": "/files/507f1f77bcf86cd799439011"
}
```

## Upload one file

`POST /files` with a multipart field named `file`. Returns `201 Created`.

```bash
curl -X POST http://localhost:7007/files \
  -H "x-app-id: merchant-portal" \
  -F "file=@./avatar.png"
```

The response includes `fileId`, `appId`, sanitized `originalName`, `fileType`, verified `mimeType`, `extension`, `size`, `status`, and timestamps. It never includes `storageKey`, provider details, or filesystem paths.

## Upload multiple files

`POST /files/bulk` with repeated multipart fields named `files`. Returns `200 OK` and processes files sequentially with per-file results.

```bash
curl -X POST http://localhost:7007/files/bulk \
  -H "x-app-id: merchant-portal" \
  -F "files=@./avatar.png" \
  -F "files=@./receipt.pdf"
```

```json
{
  "successful": [],
  "failed": [
    {
      "originalName": "unsafe.exe",
      "code": "UNSUPPORTED_FILE_TYPE",
      "message": "The file content does not match an allowed MIME type"
    }
  ]
}
```

Request-level file-count and aggregate-size failures reject the entire request. A failure after storage succeeds triggers best-effort storage compensation.

## Metadata and download

```bash
curl http://localhost:7007/files/FILE_ID \
  -H "x-app-id: merchant-portal"

curl -OJ http://localhost:7007/files/FILE_ID/download \
  -H "x-app-id: merchant-portal"
```

- `GET /files/:fileId` returns active metadata.
- `GET /files/:fileId/download` streams the file with safe `Content-Type`, `Content-Length`, and `Content-Disposition` headers.
- Deleted files and cross-application requests return `404` to avoid leaking file existence.

## Delete and recover

```bash
curl -X DELETE http://localhost:7007/files/FILE_ID \
  -H "x-app-id: merchant-portal"

curl -X POST http://localhost:7007/files/FILE_ID/recover \
  -H "x-app-id: merchant-portal"
```

Soft deletion retains the physical object but blocks normal metadata and download access. Recovery succeeds only when the metadata is deleted and the physical object still exists.

## Permanent deletion

The file must be soft-deleted first. A dedicated admin key is always required.

```bash
curl -X DELETE http://localhost:7007/files/FILE_ID/permanent \
  -H "x-app-id: merchant-portal" \
  -H "x-admin-key: YOUR_HARD_DELETE_ADMIN_KEY"
```

Permanent deletion claims the metadata as `purging`, deletes the physical object idempotently, and then removes the MongoDB record. A storage failure restores the soft-deleted state for retry.

## Health

- `GET /health/live` checks the process.
- `GET /health` and `GET /health/ready` check MongoDB plus the active storage provider and return `503` when degraded.

Health payloads contain only dependency status and active provider name—never URIs, credentials, buckets, or local paths.

## Validation and status codes

Supported defaults are JPEG, PNG, GIF, WebP, PDF, DOCX, XLSX, MP3, WAV, MP4, and WebM. The detected signature must match the declared MIME type and configured allowlist. SVG, archives, executables, unknown signatures, and mismatches are rejected.

| Status | Meaning |
| --- | --- |
| 200 | Successful read, lifecycle action, or bulk processing |
| 201 | Single file created |
| 400 | Invalid app/file identifier or missing multipart field |
| 401/403 | Missing or invalid permanent-delete credential |
| 404 | Missing, deleted, or cross-application file |
| 409 | Invalid lifecycle transition |
| 413 | File, count, or aggregate size limit exceeded |
| 415 | Unsupported or spoofed file content |
| 503 | MongoDB or active storage operation unavailable |

## Postman

Create a multipart request, add `x-app-id`, select `form-data`, and use a File value named `file` or repeated File values named `files`. Do not manually set `Content-Type`; Postman supplies the multipart boundary.
