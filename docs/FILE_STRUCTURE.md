# nestjs-file-storage-worker - Project Structure

```
nestjs-file-storage-worker/
│
├── src/
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── api-key.decorator.ts
│   │   │   └── upload-config.decorator.ts
│   │   ├── guards/
│   │   │   ├── api-key.guard.ts
│   │   │   ├── file-type.guard.ts
│   │   │   └── file-size.guard.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── dtos/
│   │   │   ├── file-response.dto.ts
│   │   │   └── file-event.dto.ts
|   |   |   └── upload-file.dto.ts
|   |   |   └── delete-file.dto.ts
│   │   ├── interfaces/
│   │   │   ├── file-metadata.interface.ts
│   │   │   ├── file-event.interface.ts
│   │   │   ├── upload-options.interface.ts
│   │   │   └── file-restrictions.interface.ts
│   │   ├── enums/
│   │   │   ├── file-action.enum.ts
│   │   │   ├── file-status.enum.ts
│   │   │   ├── storage-adapter.enum.ts
│   │   │   └── file-type.enum.ts
│   │   ├── constants/
│   │   │   ├── mime-types.constant.ts
│   │   │   └── file-restrictions.constant.ts
│   │   └── utils/
│   │       ├── file-hash.util.ts
│   │       ├── file-validator.util.ts
│   │       └── generate-file-key.util.ts
│   │
│   ├── config/
│   │   ├── storage.config.ts
│   │   ├── redis.config.ts
│   │   ├── database.config.ts
│   │   └── validation.schema.ts
│   │
│   ├── modules/
│   │   ├── files/
│   │   │   ├── controllers/
│   │   │   │   └── files.controller.ts
│   │   │   ├── services/
│   │   │   │   └── files.service.ts
│   │   │   ├── dtos/
│   │   │   │   ├── upload-file.dto.ts
│   │   │   │   ├── file-response.dto.ts
│   │   │   │   └── delete-file.dto.ts
│   │   │   ├── entities/
│   │   │   │   └── file.entity.ts
│   │   │   └── files.module.ts
│   │   ├── storage/
│   │   │   ├── adapters/
│   │   │   │   ├── local.adapter.ts
│   │   │   │   ├── s3.adapter.ts
│   │   │   │   ├── cloudinary.adapter.ts
│   │   │   │   └── storage.adapter.factory.ts
│   │   │   ├── interfaces/
│   │   │   │   └── storage.adapter.interface.ts
│   │   │   └── storage.module.ts
│   │   ├── events/
│   │   │   ├── services/
│   │   │   │   └── event-publisher.service.ts
│   │   │   ├── listeners/
│   │   │   │   └── file-event.listener.ts
│   │   │   └── events.module.ts
│   │   ├── health/
│   │   │   ├── controllers/
│   │   │   │   └── health.controller.ts
│   │   │   └── health.module.ts
│   │   └── redis/
│   │       ├── services/
│   │       │   └── redis.service.ts
│   │       └── redis.module.ts
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── test/
│   ├── unit/
│   ├── e2e/
│   └── jest.config.js
│
├── docs/
│   ├── API.md
│   └── ARCHITECTURE.md
│
├── .env.example
├── .env.production
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
├── tsconfig.json
├── nest-cli.json
├── .prettierrc
├── .eslintrc.js
├── .gitignore
├── README.md
└── LICENSE
```

## Folder Breakdown

| Folder | Purpose |
|--------|---------|
| `src/common/` | Shared utilities, guards, decorators, DTOs, enums |
| `src/config/` | Configuration files (storage, redis, database, validation) |
| `src/modules/files/` | Core file upload/download/delete operations |
| `src/modules/storage/` | Storage adapter pattern (local, S3, Cloudinary) |
| `src/modules/events/` | Redis event publishing and handling |
| `src/modules/health/` | Health check endpoint |
| `src/modules/redis/` | Redis connection and service |
| `test/` | Unit and E2E tests |
| `docs/` | API docs and architecture docs |

---

**Ready to create folders and start writing code?**