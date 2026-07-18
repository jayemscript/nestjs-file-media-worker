AGENTS.md# AGENTS.md

## Project

This repository contains `nestjs-file-media-services`, a NestJS service for file and media storage.

The immediate objective is Phase 1: implement a local filesystem storage provider behind a provider-agnostic storage interface.

Do not implement or significantly refactor AWS S3 unless the current task explicitly requests it.

## Working rules

* Inspect the existing repository before proposing or making changes.
* Reuse existing working code where appropriate.
* Do not generate a completely new NestJS project.
* Keep controllers thin.
* Keep business logic independent from HTTP and Express.
* Keep filesystem and cloud-specific logic inside storage adapters.
* Use dependency injection and explicit provider tokens.
* Use strict TypeScript types and avoid `any`.
* Follow the repository's existing linting and formatting rules.
* Do not add production dependencies without explaining why.
* Do not expose absolute local filesystem paths through API responses.
* Do not use original filenames as storage keys.
* Scope file operations by both `appId` and file identifier.
* Treat client-provided `appId` as temporary development behavior, not production authentication.
* Preserve existing routes unless a change is necessary and documented.
* Add or update tests for changed behavior.
* Run the relevant lint, build, and test commands after implementation.
* Report commands that fail and explain why.
* Never commit secrets, `.env` files, uploaded files, or test storage directories.

## Required implementation workflow

Before coding:

1. Summarize the existing architecture.
2. Explain the existing upload flow.
3. Review the experimental S3 implementation.
4. Identify security and maintainability issues.
5. Propose the target Phase 1 architecture.
6. List files that will be created or changed.
7. Identify possible breaking changes.

During implementation:

1. Make one focused milestone at a time.
2. Run relevant verification commands.
3. Review the resulting diff.
4. Report unresolved problems before continuing.

## Phase 1 boundaries

Phase 1 should eventually provide:

* Storage-provider abstraction
* Configurable local storage root
* MongoDB file metadata
* Single upload
* Bulk upload
* Metadata retrieval
* Streamed download
* Soft deletion
* Recovery
* Permanent deletion
* File-size and MIME validation
* Path-traversal prevention
* Unique storage keys
* Normalized errors
* Tests and documentation

Do not attempt all Phase 1 features in one uncontrolled change.
