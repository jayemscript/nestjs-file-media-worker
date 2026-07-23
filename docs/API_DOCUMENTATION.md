# API Documentation

Base URL for local development: `http://localhost:7007`.

## Authentication and application scope

Normal service-to-service file endpoints require a lowercase `x-app-id` header. It identifies and scopes the consuming application; it is not authentication. API keys authenticate registered service consumers, while short-lived transfer tokens authenticate direct browser transfers.

Consumer API-key authentication is controlled by these environment variables:

```dotenv
API_KEY_REQUIRED=true
API_KEYS=consumer-one-key,consumer-two-key
```

`API_KEYS` is a comma-separated list, allowing each registered consumer application to use its own key. When `API_KEY_REQUIRED=true`, requests to file endpoints must provide the key using the preferred `x-api-key` header:

```http
x-app-id: merchant-portal
x-api-key: consumer-one-key
```

The `api_key` query parameter is also supported, but the header is recommended because URLs are commonly retained in logs and browser history. Missing or invalid keys return `401 Unauthorized`. The consumer API key does not replace `x-app-id`; both are required when API-key authentication is enabled.

Transfer-authorization creation endpoints always require a valid `x-api-key`, even when `API_KEY_REQUIRED=false`. Authorized transfer endpoints require their issued Bearer token and do not trust a browser-provided `x-app-id`.

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
  -H "x-api-key: YOUR_CONSUMER_API_KEY" \
  -F "file=@./avatar.png"
```

The response includes `fileId`, `appId`, sanitized `originalName`, `fileType`, verified `mimeType`, `extension`, `size`, `status`, and timestamps. It never includes `storageKey`, provider details, or filesystem paths.

## Upload multiple files

`POST /files/bulk` with repeated multipart fields named `files`. Returns `200 OK` and processes files sequentially with per-file results.

```bash
curl -X POST http://localhost:7007/files/bulk \
  -H "x-app-id: merchant-portal" \
  -H "x-api-key: YOUR_CONSUMER_API_KEY" \
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

## Short-lived local transfers

Enable the feature only after configuring:

```dotenv
TRANSFER_AUTHORIZATION_ENABLED=true
TRANSFER_TOKEN_SIGNING_KEY=replace-with-at-least-32-random-characters
TRANSFER_TOKEN_TTL_SECONDS=300
FILE_SERVICE_PUBLIC_URL=https://files.example.com
TRANSFER_RATE_LIMIT_MAX=30
TRANSFER_RATE_LIMIT_WINDOW_SECONDS=60
```

The BFF uses its permanent API key to create a single-use authorization. The browser then transfers bytes directly with this service using only the returned short-lived Bearer token.

### Authorized local upload

The BFF requests authorization:

```bash
curl -X POST http://localhost:7007/files/authorizations/upload \
  -H "Content-Type: application/json" \
  -H "x-app-id: admin-portal" \
  -H "x-api-key: YOUR_BFF_API_KEY" \
  --data '{"maxSizeBytes":10485760,"allowedMimeTypes":["image/png","application/pdf"]}'
```

The JSON envelope contains:

```json
{
  "data": {
    "url": "http://localhost:7007/files/authorized-upload",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer v1.REDACTED"
    },
    "expiresAt": "2026-07-23T12:05:00.000Z",
    "requiresFinalization": false
  }
}
```

The browser sends the multipart upload directly to the returned URL:

```bash
curl -X POST http://localhost:7007/files/authorized-upload \
  -H "Authorization: Bearer YOUR_SHORT_LIVED_TOKEN" \
  -F "file=@./avatar.png"
```

The token supplies the trusted `appId`; do not send `x-app-id` or the permanent API key from browser code. Local uploads are validated, stored, and activated in the same request, so `requiresFinalization` is `false`.

### Authorized local download

The BFF first authorizes one active file:

```bash
curl -X POST http://localhost:7007/files/FILE_ID/authorizations/download \
  -H "x-app-id: admin-portal" \
  -H "x-api-key: YOUR_BFF_API_KEY"
```

The browser performs an authenticated request using the returned URL and Bearer header:

```bash
curl http://localhost:7007/files/FILE_ID/authorized-download \
  -H "Authorization: Bearer YOUR_SHORT_LIVED_TOKEN" \
  --output downloaded-file
```

Tokens are HMAC-signed, expire after the configured lifetime, and are atomically consumed once. Upload tokens restrict size and configured MIME types; download tokens are bound to one `appId` and `fileId`. Missing, malformed, tampered, expired, reused, or scope-mismatched tokens are rejected. Once a token is claimed, a later validation or storage failure requires a newly issued token.

## Bulk metadata and lifecycle operations

Bulk JSON operations use a `fileIds` array. They intentionally use `POST` rather than a request body on `GET`, because GET bodies are not handled consistently by clients, proxies, and caches.

```json
{
  "fileIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012"
  ]
}
```

- `POST /files/bulk/metadata` returns active metadata for multiple files.
- `DELETE /files/bulk` soft-deletes multiple active files.
- `POST /files/bulk/recover` recovers multiple soft-deleted files whose stored objects still exist.

These endpoints process files sequentially and return `200 OK` with best-effort per-file results:

```json
{
  "successful": [
    {
      "fileId": "507f1f77bcf86cd799439011",
      "appId": "merchant-portal",
      "originalName": "avatar.png",
      "status": "active"
    }
  ],
  "failed": [
    {
      "fileId": "507f1f77bcf86cd799439012",
      "code": "FILE_NOT_FOUND",
      "message": "File not found"
    }
  ]
}
```

The array must be non-empty, contain unique MongoDB ObjectIds, and stay within `MAX_BULK_FILE_COUNT`. Invalid request-level input rejects the entire request. File lookup and lifecycle transitions remain scoped by both `x-app-id` and `fileId`.

## Bulk download

`POST /files/bulk/download` accepts the same JSON body and streams a ZIP archive. This endpoint bypasses the JSON response envelope.

```bash
curl -X POST http://localhost:7007/files/bulk/download \
  -H "Content-Type: application/json" \
  -H "x-app-id: merchant-portal" \
  -H "x-api-key: YOUR_CONSUMER_API_KEY" \
  --data '{"fileIds":["507f1f77bcf86cd799439011","507f1f77bcf86cd799439012"]}' \
  --output files.zip
```

Every requested file must be active, owned by the requesting application, and physically available before streaming begins. If any file fails preflight, the request returns an error instead of a partial archive. The combined uncompressed file size must not exceed `MAX_BULK_TOTAL_SIZE_BYTES`. ZIP entry names include the file ID to prevent duplicate original filenames from colliding.

## Metadata and download

```bash
curl http://localhost:7007/files/FILE_ID \
  -H "x-app-id: merchant-portal" \
  -H "x-api-key: YOUR_CONSUMER_API_KEY"

curl -OJ http://localhost:7007/files/FILE_ID/download \
  -H "x-app-id: merchant-portal" \
  -H "x-api-key: YOUR_CONSUMER_API_KEY"
```

- `GET /files/:fileId` returns active metadata.
- `GET /files/:fileId/download` streams the file with safe `Content-Type`, `Content-Length`, and `Content-Disposition` headers.
- Deleted files and cross-application requests return `404` to avoid leaking file existence.

## Delete and recover

```bash
curl -X DELETE http://localhost:7007/files/FILE_ID \
  -H "x-app-id: merchant-portal" \
  -H "x-api-key: YOUR_CONSUMER_API_KEY"

curl -X POST http://localhost:7007/files/FILE_ID/recover \
  -H "x-app-id: merchant-portal" \
  -H "x-api-key: YOUR_CONSUMER_API_KEY"
```

Soft deletion retains the physical object but blocks normal metadata and download access. Recovery succeeds only when the metadata is deleted and the physical object still exists.

## Permanent deletion

The file must be soft-deleted first. A dedicated admin key is always required.

```bash
curl -X DELETE http://localhost:7007/files/FILE_ID/permanent \
  -H "x-app-id: merchant-portal" \
  -H "x-api-key: YOUR_CONSUMER_API_KEY" \
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
| 401 | Missing/invalid consumer API key or transfer authorization |
| 403 | Missing or invalid permanent-delete admin key |
| 404 | Missing, deleted, or cross-application file |
| 409 | Invalid lifecycle transition or reused transfer token |
| 413 | File, count, or aggregate size limit exceeded |
| 415 | Unsupported or spoofed file content |
| 429 | Authorized-transfer rate limit exceeded |
| 503 | MongoDB or active storage operation unavailable |

## Postman

For every file request, add `x-app-id` and, when API-key authentication is enabled, `x-api-key`. For uploads, select `form-data` and use a File value named `file` or repeated File values named `files`. Do not manually set `Content-Type`; Postman supplies the multipart boundary.

For bulk JSON operations, select **Body → raw → JSON** and send `{ "fileIds": ["..."] }`. For bulk download, use **Send and Download** in Postman and save the response as `files.zip`.

For authorized transfers, first call the appropriate authorization endpoint and copy `data.headers.Authorization`. Add that complete value as the `Authorization` header on the upload or download request. A token cannot be reused after it is claimed.
