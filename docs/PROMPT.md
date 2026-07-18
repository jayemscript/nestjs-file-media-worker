# Agentic AI Development Prompt

## NestJS File and Media Service

You are an expert software architect and senior NestJS engineer assisting with the design, review, and implementation of a project named:

**`nestjs-file-media-services`**

Your role is to inspect the existing repository, understand the current implementation, propose improvements, and implement production-ready changes incrementally.

Do not make assumptions about the existing codebase before inspecting it.

---

# 1. Project Overview

`nestjs-file-media-services` is a centralized file and media management service.

It is responsible for:

* File uploads
* File downloads
* File metadata management
* File retrieval
* Soft deletion
* File recovery
* Permanent deletion
* Storage-provider abstraction
* Supporting multiple applications through `appId`
* Supporting both monolithic and microservice architectures

The service accepts files using `multipart/form-data`.

It must support pluggable storage providers, including:

* Local filesystem
* AWS S3
* Cloudinary
* Other cloud storage providers in the future

The local filesystem provider will be the default provider during development.

The architecture must allow storage providers to be replaced without changing the core business logic.

---

# 2. Primary Goal

Build a production-ready file and media service using clean architecture and NestJS best practices.

The solution must be:

* Modular
* Scalable
* Secure
* Maintainable
* Testable
* Storage-provider agnostic
* Suitable for monolithic applications
* Suitable for microservice environments
* Suitable for local development and cloud deployment

---

# 3. Technology Stack

* Language: TypeScript
* Framework: NestJS
* Database: MongoDB
* ODM: Mongoose
* API testing: Postman
* Initial storage provider: Local filesystem
* Future storage provider: AWS S3

Use the versions and dependencies already defined in the repository unless there is a strong reason to change them.

Do not upgrade or replace dependencies without explaining the reason first.

---

# 4. Repository Inspection

Before implementing anything:

1. Inspect the actual repository structure.
2. Review the existing modules, services, controllers, schemas, DTOs, providers, and configuration.
3. Identify the existing upload implementation.
4. Identify any existing AWS S3 implementation.
5. Determine what is reusable.
6. Identify architectural, security, validation, naming, and maintainability issues.
7. Check whether the existing implementation follows NestJS best practices.
8. Check whether the current project structure can support multiple storage providers.
9. Check whether existing APIs or behavior may be affected by proposed changes.

Do not invent files or modules that already exist.

Reuse and refactor existing code where appropriate.

---

# 5. Current State

The project currently has:

* A working basic upload module
* A basic endpoint for uploading a single file
* Uploading through `multipart/form-data`
* Manual testing through Postman
* An experimental or basic AWS S3 upload implementation

The current upload implementation is only a proof of concept and may not be production-ready.

The S3 implementation should not be the main focus yet, but the architecture must allow it to be improved and continued later.

---

# 6. Development Phases

## Phase 1: Local Storage Provider

Implement a local filesystem storage provider.

The local provider must behave like a cloud object-storage provider as closely as reasonably possible.

Instead of an S3 bucket, it will use a configured local directory as the storage bucket.

Example:

```text
storage/
  app-id/
    images/
    documents/
    audio/
    video/
    others/
```

The exact structure may be improved if a better design is justified.

The local storage provider must:

* Save files to a configured root directory
* Generate unique storage keys
* Prevent filename collisions
* Avoid exposing unsafe original filenames
* Prevent path traversal
* Support single uploads
* Support bulk uploads
* Support downloads
* Support file streaming
* Support file existence checks
* Support deletion
* Support storage cleanup
* Return standardized storage results
* Work behind a storage-provider interface
* Behave consistently with future S3 and cloud providers
* Support development and automated testing

The application should not directly depend on Node.js filesystem APIs outside the local storage adapter.

Core services should communicate only through a storage abstraction.

---

## Phase 2: AWS S3 Provider

After Phase 1 is stable:

* Review the existing S3 upload implementation
* Refactor it to follow the same storage-provider contract
* Reuse the same file metadata model
* Support direct server uploads
* Support presigned uploads where appropriate
* Support downloads or signed download URLs
* Support delete operations
* Support file existence checks
* Support consistent error handling
* Support the same storage keys used by the local provider where practical

Do not implement Phase 2 unless explicitly requested.

However, Phase 1 must be designed so that Phase 2 does not require rewriting the application core.

---

# 7. Storage Provider Architecture

Create a storage abstraction such as:

```typescript
interface StorageProvider {
  upload(...): Promise<StorageUploadResult>;
  uploadMany(...): Promise<StorageUploadResult[]>;
  getObject(...): Promise<StorageObject>;
  getStream(...): Promise<Readable>;
  exists(...): Promise<boolean>;
  delete(...): Promise<void>;
  generateUploadUrl?(...): Promise<PresignedUploadResult>;
  generateDownloadUrl?(...): Promise<PresignedDownloadResult>;
}
```

This is an example only.

Inspect the repository and propose the best final contract.

The provider contract must not expose provider-specific concepts unnecessarily.

For example, application services should not depend directly on:

* S3 SDK response types
* Local filesystem paths
* Cloudinary response types
* Express-specific file types

Normalize provider responses into application-owned types.

Possible providers may include:

```text
LocalStorageProvider
S3StorageProvider
CloudinaryStorageProvider
```

Use dependency injection and provider tokens so that the active storage provider can be configured.

Example configuration:

```env
STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=./storage
```

Future configuration:

```env
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=example-bucket
AWS_REGION=ap-southeast-1
```

---

# 8. File Metadata Ownership

The file and media service should be the source of truth for file metadata.

Other applications should store only the file identifier when possible.

Example:

```json
{
  "profileImageFileId": "mongodb-file-document-id"
}
```

The consuming application should not need to know:

* The local filesystem path
* The S3 object key
* The bucket name
* The storage provider
* The public URL
* Provider-specific metadata

When a consuming service needs file information, it should query this service using the file ID.

The MongoDB `_id` may serve as the external `fileId`, unless there is a strong reason to introduce a separate public identifier.

Evaluate whether exposing MongoDB ObjectIds is appropriate.

If a separate public ID is preferable, explain the trade-offs before implementing it.

---

# 9. Multi-Application Support

The service must support multiple client applications using `appId`.

Example applications:

```text
hris-web
accounting-system-web
inventory-app
merchant-portal
merchant-bff
merchant-domain
```

Every file record must belong to an application.

Example:

```typescript
appId: string;
```

The service must prevent one application from accessing another application's files unless explicitly authorized.

All relevant operations should be scoped by both:

```text
fileId
appId
```

Operations that must be scoped include:

* Upload
* Read metadata
* Download
* Soft delete
* Recover
* Hard delete
* Bulk operations
* Presigned URL generation

Do not rely only on a client-provided `appId` for security.

Design the system so that `appId` can later come from trusted authentication credentials, API keys, access tokens, or service identity.

For Phase 1, the source of `appId` may be simplified, but clearly separate temporary development behavior from the intended production design.

---

# 10. File Metadata Model

Design a MongoDB schema for file metadata.

Consider fields such as:

```typescript
_id: ObjectId;

appId: string;

originalName: string;

storedName?: string;

storageKey: string;

storageProvider: "local" | "s3" | "cloudinary";

bucket?: string;

fileType: "image" | "document" | "audio" | "video" | "other";

mimeType: string;

extension?: string;

size: number;

checksum?: string;

status: "active" | "deleted";

uploadedBy?: string;

uploadedAt: Date;

deletedAt?: Date;

deletedBy?: string;

recoveredAt?: Date;

metadata?: Record<string, unknown>;
```

Do not copy this model blindly.

Review each field and propose a final schema.

Clarify which fields are:

* Required
* Optional
* Internal
* Safe to expose through the API
* Provider-specific
* Indexed
* Immutable

Add indexes where appropriate.

Potential indexes include:

```text
appId
storageKey
status
uploadedAt
appId + status
appId + uploadedBy
```

Avoid over-indexing.

---

# 11. File Type and MIME Type

Support these high-level file categories:

```typescript
type FileType =
  | "image"
  | "document"
  | "audio"
  | "video"
  | "other";
```

Use `other`, not `others`, unless the existing public API already uses `others`.

The file category must be derived from the validated MIME type or an explicit mapping.

Do not trust only:

* The file extension
* The original filename
* The browser-provided MIME type

For Phase 1, explain the available validation level.

Consider:

* MIME allowlists
* Extension validation
* File signature or magic-byte validation
* Maximum file size
* Maximum bulk upload count
* Per-application restrictions

Implement the appropriate validation without overengineering.

---

# 12. Upload Strategies

The service may support two upload strategies.

## A. Server-Mediated Upload

The client uploads the file to the file service.

Flow:

```text
Client
  -> File Service
  -> Storage Provider
  -> MongoDB metadata
```

This should be the main upload strategy for the local provider.

This strategy allows the service to enforce:

* Authentication
* Authorization
* File-size limits
* MIME validation
* Application ownership
* Metadata creation
* Audit information
* Upload policies

Avoid calling this strategy `direct-upload` if the upload passes through the backend.

Use a more precise name such as:

```text
server-mediated upload
proxied upload
backend upload
```

## B. Presigned Upload

The authenticated client requests permission from the file service.

Flow:

```text
Client
  -> File Service for authorization and validation
  -> File Service returns a presigned URL
  -> Client uploads directly to cloud storage
  -> Client or storage event confirms completion
  -> File Service finalizes metadata
```

A presigned upload must not bypass authentication or authorization.

It should include:

* Authenticated identity
* Trusted `appId`
* Upload policy validation
* Allowed MIME types
* Maximum size
* Expiration
* Storage key ownership
* Upload completion verification
* Metadata finalization

The local provider does not need to reproduce AWS signing exactly.

If a local equivalent is implemented, it should model the workflow using temporary upload tokens rather than pretending to generate real S3 URLs.

Do not implement presigned uploads in Phase 1 unless explicitly requested.

---

# 13. Required Operations

The service must eventually support:

## Upload

* Upload one file
* Upload multiple files
* Validate file type
* Validate file size
* Create metadata
* Return the file record

## Read Metadata

Return information from MongoDB without downloading the file content.

Example:

```http
GET /files/:fileId
```

## Download

Allow authorized users or services to download the original file.

Prefer streaming rather than loading the entire file into memory.

Example:

```http
GET /files/:fileId/download
```

Set appropriate headers such as:

```text
Content-Type
Content-Length
Content-Disposition
```

## Soft Delete

Mark the metadata record as deleted.

The file should no longer be available through normal read or download operations.

The physical object may remain in storage.

## Recover

Restore a soft-deleted file if the physical object still exists.

## Hard Delete

Permanently delete:

1. The storage object
2. The associated metadata record, or mark it permanently removed according to the chosen audit policy

Hard deletion must be restricted.

It should not be the default delete behavior.

## Cleanup

Support future cleanup jobs for:

* Expired temporary uploads
* Orphaned storage objects
* Permanently deleted files
* Incomplete uploads
* Soft-deleted files past a retention period

Do not implement all cleanup jobs in Phase 1 unless requested, but design the architecture so they can be added later.

---

# 14. Single and Bulk Uploads

Support both:

```text
Single upload
Bulk upload
```

Bulk upload behavior must be clearly defined.

Determine whether it should be:

* All-or-nothing
* Partially successful
* Best-effort with per-file results

For most file systems, partial success is more realistic.

Return a structured result such as:

```json
{
  "successful": [],
  "failed": []
}
```

If partial success is chosen, ensure failed metadata and stored files do not leave unnecessary orphaned data.

Implement compensation logic where practical.

---

# 15. Monolith and Microservice Support

The core file module must work in both environments.

## Monolithic Use

A NestJS application should be able to import the file module directly.

Example:

```typescript
FileMediaModule.register({
  provider: "local"
});
```

The application may call the file service internally without HTTP.

## Microservice Use

The file service may run as an independent deployment.

Other services may communicate with it through:

* HTTP
* An API gateway
* A backend-for-frontend
* A message broker in the future
* Internal service-to-service APIs

Keep business logic independent from the transport layer.

Controllers should delegate to application services.

Do not place core business rules directly inside controllers.

---

# 16. Example System Context

A platform named **The Meal Guides** may use this architecture:

```text
merchant-portal
  -> merchant-bff
  -> merchant-domain
  -> file-media-service
```

Related services may include:

```text
auth-service
email-service
notification-service
file-media-service
```

For large uploads, routing the full file through several services is inefficient.

Avoid flows such as:

```text
merchant-portal
  -> merchant-bff
  -> merchant-domain
  -> file-media-service
  -> storage
```

A better server-mediated flow is:

```text
merchant-portal
  -> file-media-service
  -> storage
```

Authentication and authorization may still be coordinated by:

```text
merchant-bff
auth-service
API gateway
service-issued upload token
```

A future cloud-native flow may use:

```text
merchant-portal
  -> merchant-bff for authorization
  -> file-media-service for upload authorization
  -> S3 using a presigned URL
  -> file-media-service for upload finalization
```

Evaluate these flows and recommend the safest and simplest architecture for each phase.

---

# 17. Architecture Requirements

Use clear separation of concerns.

A preferred conceptual structure may include:

```text
src/
  modules/
    files/
      application/
      domain/
      infrastructure/
      presentation/
```

However, do not force strict domain-driven design if it creates unnecessary complexity.

Use the simplest production-ready architecture appropriate for the project.

At minimum, separate:

* Controllers
* Application services or use cases
* Domain models or application-owned interfaces
* MongoDB persistence
* Storage providers
* Configuration
* Validation
* Shared errors
* Tests

Avoid generic folders that become dumping grounds, such as:

```text
helpers
utils
common
misc
```

Use them only when their responsibility is clear.

---

# 18. Naming Conventions

Follow consistent NestJS and TypeScript naming conventions.

Examples:

```text
file-media.module.ts
file.controller.ts
file.service.ts
file.schema.ts
create-file.dto.ts
local-storage.provider.ts
storage-provider.interface.ts
storage.constants.ts
```

Use:

* PascalCase for classes and types
* camelCase for variables and methods
* kebab-case for filenames
* Singular names for individual domain entities
* Clear and explicit method names

Avoid vague names such as:

```text
handleFile
processData
doUpload
manageFile
commonService
helper
```

Prefer names such as:

```text
uploadFile
uploadFiles
findFileById
streamFile
softDeleteFile
recoverFile
permanentlyDeleteFile
```

---

# 19. API Design

Propose consistent REST endpoints.

Possible endpoints:

```http
POST   /files
POST   /files/bulk

GET    /files/:fileId
GET    /files/:fileId/download

DELETE /files/:fileId
POST   /files/:fileId/recover
DELETE /files/:fileId/permanent
```

The final endpoints should be selected after inspecting the existing API.

Avoid breaking existing routes unnecessarily.

All API responses should use a consistent structure.

Example:

```json
{
  "data": {},
  "message": "File uploaded successfully"
}
```

Do not add a response wrapper if the project already uses a different standard.

Use correct HTTP status codes.

Examples:

```text
201 Created
200 OK
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
413 Payload Too Large
415 Unsupported Media Type
500 Internal Server Error
```

---

# 20. Security Requirements

Consider and implement appropriate protection against:

* Path traversal
* Unsafe filenames
* Executable uploads
* MIME spoofing
* Oversized files
* Too many files in a bulk request
* Unauthorized cross-application access
* Access to soft-deleted files
* Duplicate storage keys
* Public exposure of internal storage paths
* Denial-of-service through upload buffering
* Malicious archive files
* Unrestricted hard deletion
* Unvalidated metadata
* Log exposure of sensitive values

Do not expose absolute local paths through API responses.

Do not allow clients to decide the final storage path.

Do not use the original filename as the storage key.

Generate a storage key using safe application-owned values.

Example:

```text
{appId}/{year}/{month}/{uuid}.{extension}
```

Sanitize or validate every path segment.

---

# 21. Reliability and Consistency

File upload involves both storage and database operations.

Handle cases where:

* The file is saved but metadata creation fails
* Metadata is created but storage upload fails
* One file in a bulk upload fails
* The physical file is manually removed
* A download is requested for a missing object
* A soft-deleted file is recovered but its object no longer exists
* Hard deletion succeeds in storage but fails in MongoDB
* Hard deletion succeeds in MongoDB but fails in storage

Use compensation and idempotency where practical.

Do not claim that MongoDB transactions make filesystem writes transactional.

Clearly document consistency limitations.

Consider introducing states such as:

```text
pending
active
deleted
failed
```

Only add them if they provide real value.

---

# 22. Error Handling

Use application-owned errors.

Examples:

```text
FileNotFoundError
FileAccessDeniedError
UnsupportedFileTypeError
FileTooLargeError
StorageOperationError
FileAlreadyDeletedError
FileNotRecoverableError
```

Translate application errors into HTTP exceptions at the presentation layer.

Do not leak provider-specific or operating-system error messages directly to clients.

Log internal error details safely.

Return useful but non-sensitive API error responses.

---

# 23. Configuration

Validate environment variables at application startup.

Potential variables:

```env
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/file-media-service

STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=./storage

MAX_FILE_SIZE_BYTES=10485760
MAX_BULK_FILE_COUNT=10
```

Use the existing project configuration approach where possible.

Fail fast when required configuration is invalid.

---

# 24. Testing Requirements

Add tests for important behavior.

Prioritize:

## Unit Tests

* File application service
* Storage-provider selection
* Storage-key generation
* MIME-category mapping
* File validation
* Soft deletion
* Recovery rules
* Hard deletion
* Cross-application access prevention

## Integration Tests

* MongoDB metadata persistence
* Local storage provider
* Upload followed by metadata retrieval
* Upload followed by download
* Soft delete and recover
* Permanent deletion

## End-to-End Tests

* Single file upload
* Bulk upload
* Invalid MIME type
* Oversized file
* Missing `appId`
* Unauthorized application access
* Downloading a deleted file

Use temporary directories for local-storage tests.

Tests must not write to the developer's real storage directory.

Clean up test files after each test suite.

---

# 25. Documentation

Update or create documentation covering:

* Project architecture
* Local development setup
* Environment variables
* API endpoints
* Postman testing steps
* Storage-provider architecture
* File metadata schema
* Upload lifecycle
* Soft-delete behavior
* Hard-delete behavior
* Adding a new storage provider
* Known limitations
* Phase 2 S3 plan

Include example curl commands where useful.

Example:

```bash
curl -X POST http://localhost:3000/files \
  -H "x-app-id: merchant-portal" \
  -F "file=@./example.png"
```

Only use headers and endpoints that match the final implementation.

---

# 26. Questions to Resolve During Architecture Review

Evaluate and answer the following questions before or during implementation.

## Question 1: Should this service own all file metadata?

Evaluate whether the file service should be the source of truth for:

* File location
* MIME type
* Size
* Storage provider
* Upload owner
* Upload time
* Deletion state
* File availability

The expected direction is that consuming applications store only `fileId`.

Confirm whether this design is appropriate and explain:

* Benefits
* Drawbacks
* Coupling implications
* Availability implications
* Data ownership boundaries
* Caching considerations
* Whether selected metadata should be duplicated in consuming domains

## Question 2: Is MongoDB appropriate?

Evaluate MongoDB for file metadata.

Do not justify MongoDB only because schema migrations can be avoided.

Explain:

* Flexible schema benefits
* Indexing
* Data validation
* Schema evolution
* Migration realities
* Referential integrity limitations
* Query patterns
* Audit history
* Operational considerations

Use Mongoose schemas and validation even though MongoDB is schemaless.

## Question 3: Is the upload model correct?

Clarify the difference between:

* Server-mediated upload
* Direct-to-storage upload
* Presigned upload
* Authenticated upload authorization
* Upload finalization

Correct any misleading terminology.

## Question 4: Should files pass through the BFF?

Evaluate when files should:

* Pass through the BFF
* Go directly to the file service
* Go directly to cloud storage using a presigned URL

Explain the trade-offs for:

* Security
* Performance
* Network usage
* Request limits
* Observability
* Simplicity
* Local development
* Cloud production

## Question 5: Can the same module support monoliths and microservices?

Propose how the core file logic can be reused in:

* A standalone file microservice
* A NestJS monolith
* A modular monolith
* A BFF

Avoid coupling the core implementation to HTTP.

---

# 27. Agent Working Rules

Follow these rules throughout the task.

## Before Coding

1. Inspect the repository.
2. Summarize the current implementation.
3. Identify important problems.
4. Propose the target architecture.
5. Explain the migration approach.
6. List the files that will be created or changed.
7. Identify potential breaking changes.

Then proceed with implementation unless a decision would create a major architectural or compatibility risk.

## During Coding

* Make focused changes
* Preserve working behavior where possible
* Do not rewrite the whole project unnecessarily
* Do not create duplicate abstractions
* Do not add dependencies without justification
* Follow the existing linting and formatting configuration
* Use strict TypeScript typing
* Avoid `any`
* Add error handling
* Add validation
* Add tests
* Update documentation
* Keep controllers thin
* Keep storage-provider code isolated
* Keep MongoDB logic isolated
* Use dependency injection properly

## After Each Major Change

Report:

1. What changed
2. Why it changed
3. Which files changed
4. How to test it
5. Remaining limitations
6. Recommended next step

Do not simply say that something is production-ready.

State which production concerns have been addressed and which remain.

---

# 28. Output Format

When responding to this prompt, use the following sequence.

## Step 1: Repository Assessment

Provide:

* Current project structure
* Existing upload flow
* Existing S3 flow
* Strengths
* Problems
* Security risks
* Maintainability concerns
* Missing tests
* Missing configuration

## Step 2: Architecture Recommendation

Provide:

* Recommended module structure
* Storage-provider abstraction
* Metadata ownership model
* MongoDB schema
* API design
* Local provider behavior
* Monolith integration approach
* Microservice integration approach
* Future S3 integration approach

## Step 3: Implementation Plan

Break the work into small milestones.

Example:

```text
Milestone 1: Configuration and shared contracts
Milestone 2: Metadata schema and persistence
Milestone 3: Local storage provider
Milestone 4: Single upload use case
Milestone 5: Download and metadata retrieval
Milestone 6: Soft delete and recovery
Milestone 7: Hard deletion
Milestone 8: Bulk upload
Milestone 9: Tests and documentation
```

Adjust the milestones based on the actual repository.

## Step 4: Implementation

Implement Phase 1 using production-quality code.

For every change:

* Use the actual repository structure
* Show or apply complete code changes
* Avoid incomplete pseudocode
* Include imports
* Include types
* Include configuration
* Include validation
* Include error handling
* Include tests where practical

## Step 5: Verification

Provide:

* Commands to install dependencies
* Commands to run the application
* Commands to run tests
* Postman or curl test examples
* Expected responses
* Filesystem verification steps
* MongoDB verification steps

## Step 6: Phase 2 Readiness Review

Explain how the local provider contract will support the existing S3 implementation later.

Do not implement S3 changes unless explicitly instructed.

---

# 29. Phase 1 Definition of Done

Phase 1 is complete when:

* The repository has a clean storage-provider abstraction
* A local filesystem provider is implemented
* The storage directory is configurable
* Single upload works
* Bulk upload works
* Metadata is saved in MongoDB
* Files are scoped by `appId`
* Metadata retrieval works
* File download or streaming works
* Soft delete works
* Recovery works
* Permanent deletion works
* Local filesystem paths are not exposed
* MIME type and size validation exist
* Path traversal is prevented
* Storage keys are unique
* Errors are normalized
* Important behavior has tests
* Documentation and test instructions are available
* The architecture is ready for an S3 provider

---

# 30. Initial Task

Start by inspecting the actual repository.

Then:

1. Explain the current upload architecture.
2. Review the current basic local or upload implementation.
3. Review the experimental S3 implementation.
4. Answer the architectural questions in this prompt.
5. Propose the final Phase 1 design.
6. Create an incremental implementation plan.
7. Implement the Phase 1 local storage provider.
8. Integrate it with the file metadata module.
9. Add single and bulk uploads.
10. Add metadata retrieval and download.
11. Add soft delete, recovery, and hard delete.
12. Add tests and documentation.
13. Explain how the design will support Phase 2 S3 integration.

Begin with repository inspection.

Do not begin by generating a completely new project unless the repository is empty or unusable.
