# Project Structure

```text
src/
  common/
    decorators/       Response-transform and API-key requirement metadata
    dtos/             Shared error response shape
    errors/           Application-owned error codes
    filters/          HTTP error translation
    interceptors/     Logging and JSON response envelope
  config/             MongoDB, storage, transfers, and startup validation
  modules/
    files/
      controllers/    File API and authorized browser-transfer adapters
      domain/         Application-owned metadata, operation, and transfer types
      dtos/           Validated bulk and transfer-authorization requests
      guards/         Permanent-delete and transfer rate-limit checks
      presentation/   Safe download headers, Bearer parsing, and ZIP streaming
      repositories/   File and transfer replay repository contracts/adapters
      schemas/        File metadata and transfer authorization indexes
      services/       App context, validation, file, and transfer use cases
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
  LOCAL_TRANSFER_AUTHORIZATION_PLAN.md
  MONOLITH_VS_MICROSERVICES.md
  SECURITY.md
```

Only the local adapter is implemented in Phase 1. S3 and Cloudinary placeholder files were removed so an empty file cannot be mistaken for a working provider. Phase 2 adds an S3 adapter behind the existing storage contract.
