# Architecture

## Ownership and data flow

The file service owns canonical location, MIME type, size, checksum, provider, timestamps, and lifecycle state. Consuming applications should persist only `fileId`; selectively cached display metadata is non-authoritative.

Phase 1 server-mediated flow:

```text
client -> FilesController -> FilesService -> StorageProvider (local)
                                      -> FileMetadataRepository (MongoDB)
```

File bytes should go directly from the client to this service rather than through a BFF and domain service. A BFF or gateway may authorize the request without proxying the multipart body.

Optional short-lived local transfer flow:

```text
admin portal -> BFF -> file service: create scoped authorization
admin portal -> file service -> local provider: transfer using one-time token
```

The BFF keeps its permanent API key. The browser receives a short-lived token whose signed claims carry the trusted `appId`, operation, expiry, and transfer constraints. MongoDB atomically claims the token once and cleans expired replay records with a TTL index.

## Boundaries

- Controllers translate HTTP/Multer values into application-owned inputs and set download headers.
- `FilesService` owns validation orchestration, app scoping, lifecycle rules, and storage/database compensation.
- `FileMetadataRepository` isolates Mongoose and always scopes records by `appId` and `fileId`.
- `StorageProvider` owns provider-specific object operations. Application code never receives an absolute path or SDK response.
- `LocalStorageProvider` is the only filesystem consumer. It creates its root, rejects unsafe keys, and uses collision-safe writes.

The exported `FilesService` can be called from a NestJS monolith without HTTP. The controllers provide the standalone microservice API.

## Metadata and consistency

MongoDB `_id` is the Phase 1 public `fileId`. Storage keys are internal and have the form `{appId}/{fileType}/{year}/{month}/{uuid}.{validatedExtension}`.

Storage and MongoDB cannot share a transaction:

- Upload writes storage first and compensates the object if metadata creation fails.
- Bulk upload is best-effort per file.
- Recovery checks object existence before changing metadata.
- Permanent deletion atomically changes `deleted` to `purging`, deletes storage, then deletes metadata. Failed storage deletion restores `deleted`.

## Security model

All queries include `appId` and `fileId`; cross-application access is indistinguishable from a missing file. `x-app-id` identifies the consuming application but does not authenticate it. Normal service requests use API-key or gateway authentication; direct browser routes derive `appId` from the signed transfer token rather than trusting a browser header.

Content is verified using magic bytes, declared MIME comparison, an allowlist, size/count limits, safe filename handling, and opaque keys. See `SECURITY.md` for remaining responsibilities.

## Phase 2 S3 readiness

Phase 2 adds an `S3StorageProvider` implementing the existing put/read/exists/delete/health contract with AWS PutObject, GetObject, HeadObject, DeleteObject, and bucket readiness operations. Files services, metadata schema, lifecycle behavior, and HTTP endpoints do not change.

Presigned upload is a separate future workflow: authorization creates an owned pending key, the client uploads to S3, and finalization verifies the object before activating metadata. It will not reuse the server-mediated endpoint or bypass application identity.
