# Project Structure

```text
src/
  common/
    decorators/       Response-transform metadata
    dtos/             Shared error response shape
    errors/           Application-owned error codes
    filters/          HTTP error translation
    interceptors/     Logging and JSON response envelope
  config/             MongoDB, storage, and startup validation
  modules/
    files/
      controllers/    Multipart and download HTTP adapter
      domain/         Application-owned metadata and operation types
      guards/         Permanent-delete credential check
      presentation/   Safe download-header formatting
      repositories/   Repository contract and Mongoose implementation
      schemas/        Mongoose schema and indexes
      services/       App context, validation, and file use cases
    storage/
      adapters/       Local filesystem implementation
      interfaces/     Provider-agnostic storage contract
    health/            Liveness and dependency readiness
  app.module.ts        Configuration, MongoDB, files, and health composition
  app.setup.ts         Shared HTTP application configuration
  main.ts              Standalone service bootstrap

test/
  app.e2e-spec.ts
  files.repository.integration-spec.ts
  jest-e2e.json
  jest-integration.json

docs/
  API_DOCUMENTATION.md
  ARCHITECTURE.md
  SECURITY.md
```

Only the local adapter is implemented in Phase 1. S3 and Cloudinary placeholder files were removed so an empty file cannot be mistaken for a working provider. Phase 2 adds an S3 adapter behind the existing storage contract.
