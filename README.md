# NestJS File and Media Service

A provider-agnostic NestJS service for file storage and metadata. Phase 1 uses a secure local filesystem provider and MongoDB metadata; AWS S3 is reserved for Phase 2.

## Requirements

- Node.js 22 or newer
- pnpm 11
- A MongoDB or MongoDB Atlas database

## Local setup

1. Install packages:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and provide at least `MONGO_URI`, `MONGO_DB_NAME`, and a long `HARD_DELETE_ADMIN_KEY`.

3. Start the service:

   ```bash
   pnpm run start:dev
   ```

The local provider creates `./upload` automatically. The directory is ignored by Git and must never be committed.

## Verification

```bash
pnpm run lint
pnpm run build
pnpm run test --runInBand
pnpm run test:integration
pnpm run test:e2e
```

Integration and e2e tests use `MONGO_TEST_URI` when present, otherwise `MONGO_URI`. They refuse to run unless `MONGO_TEST_DB_NAME` ends in `_test`, and they clean only their own application-scoped records.

## Documentation

- [API documentation](docs/API_DOCUMENTATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Monolith vs. microservices](docs/MONOLITH_VS_MICROSERVICES.md)
- [Security](docs/SECURITY.md)

## Phase 1 limitations

- Uploads are buffered in memory within configured file/count limits. Downloads are streamed.
- `x-app-id` is a development identity adapter, not production authentication.
- Only local storage is implemented. S3 environment variables are not validated until S3 becomes the active Phase 2 provider.
- Files uploaded by the removed S3 proof of concept are not migrated because they have no MongoDB metadata.
