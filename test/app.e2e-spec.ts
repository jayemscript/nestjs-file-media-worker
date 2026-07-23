import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import type { PublicFileMetadata } from '../src/modules/files/domain/file-metadata';

interface ApiEnvelope<T> {
  statusCode: number;
  data: T;
}

interface ApiError {
  statusCode: number;
  error: string;
}

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlS8qsAAAAASUVORK5CYII=',
  'base64',
);
const TEST_APP_ID = 'e2e-merchant-portal';
const ADMIN_KEY = 'e2e-admin-key-with-sufficient-length';
const API_KEY = 'e2e-admin-bff-api-key';
const TRANSFER_SIGNING_KEY =
  'e2e-transfer-signing-key-with-sufficient-length';
const mongoUri = process.env.MONGO_TEST_URI ?? process.env.MONGO_URI;
const testDatabaseName =
  process.env.MONGO_TEST_DB_NAME ?? 'file_media_service_test';

if (!mongoUri) {
  throw new Error('MONGO_TEST_URI or MONGO_URI is required for e2e tests');
}
if (!testDatabaseName.endsWith('_test')) {
  throw new Error('MONGO_TEST_DB_NAME must end in _test');
}

describe('File media service (e2e)', () => {
  let app: INestApplication<App>;
  let temporaryDirectory: string;
  let connection: Connection;

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'file-media-e2e-'));
    process.env.MONGO_URI = mongoUri;
    process.env.MONGO_DB_NAME = testDatabaseName;
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = temporaryDirectory;
    process.env.HARD_DELETE_ADMIN_KEY = ADMIN_KEY;
    process.env.MAX_FILE_SIZE_BYTES = '1024';
    process.env.MAX_BULK_FILE_COUNT = '3';
    process.env.MAX_BULK_TOTAL_SIZE_BYTES = '2048';
    process.env.API_KEY_REQUIRED = 'false';
    process.env.API_KEYS = API_KEY;
    process.env.TRANSFER_AUTHORIZATION_ENABLED = 'true';
    process.env.TRANSFER_TOKEN_SIGNING_KEY = TRANSFER_SIGNING_KEY;
    process.env.TRANSFER_TOKEN_TTL_SECONDS = '300';
    process.env.FILE_SERVICE_PUBLIC_URL = 'http://localhost:7007';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
    connection = app.get<Connection>(getConnectionToken());
  });

  afterEach(async () => {
    if (connection) {
      await connection.collection('files').deleteMany({ appId: TEST_APP_ID });
      await connection
        .collection('transfer_authorizations')
        .deleteMany({ appId: TEST_APP_ID });
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it('reports live and ready dependencies', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ApiEnvelope<{
          status: string;
        }>;
        expect(body.data.status).toBe('alive');
      });

    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ApiEnvelope<{
          status: string;
        }>;
        expect(body.data.status).toBe('ready');
      });
  });

  it('requires x-app-id for uploads', async () => {
    await request(app.getHttpServer())
      .post('/files')
      .attach('file', ONE_PIXEL_PNG, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(400)
      .expect((response) => {
        const body = response.body as unknown as ApiError;
        expect(body.error).toBe('INVALID_APP_ID');
      });
  });

  it('uploads, scopes, streams, deletes, recovers, and permanently deletes', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post('/files')
      .set('x-app-id', TEST_APP_ID)
      .attach('file', ONE_PIXEL_PNG, {
        filename: '../../avatar.exe',
        contentType: 'image/png',
      })
      .expect(201);
    const uploadBody =
      uploadResponse.body as unknown as ApiEnvelope<PublicFileMetadata>;
    const fileId = uploadBody.data.fileId;
    expect(uploadBody.data.originalName).toBe('avatar.exe');
    expect(uploadBody.data).not.toHaveProperty('storageKey');

    await request(app.getHttpServer())
      .get(`/files/${fileId}`)
      .set('x-app-id', 'other-app')
      .expect(404);
    await request(app.getHttpServer())
      .get(`/files/${fileId}`)
      .set('x-app-id', TEST_APP_ID)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/files/${fileId}/download`)
      .set('x-app-id', TEST_APP_ID)
      .expect('Content-Type', /image\/png/)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/files/${fileId}`)
      .set('x-app-id', TEST_APP_ID)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/files/${fileId}/download`)
      .set('x-app-id', TEST_APP_ID)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/files/${fileId}/recover`)
      .set('x-app-id', TEST_APP_ID)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/files/${fileId}/permanent`)
      .set('x-app-id', TEST_APP_ID)
      .set('x-admin-key', ADMIN_KEY)
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/files/${fileId}`)
      .set('x-app-id', TEST_APP_ID)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/files/${fileId}/permanent`)
      .set('x-app-id', TEST_APP_ID)
      .set('x-admin-key', 'invalid-admin-key')
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/files/${fileId}/permanent`)
      .set('x-app-id', TEST_APP_ID)
      .set('x-admin-key', ADMIN_KEY)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/files/${fileId}`)
      .set('x-app-id', TEST_APP_ID)
      .expect(404);
  });

  it('returns successful and failed entries for bulk uploads', async () => {
    await request(app.getHttpServer())
      .post('/files/bulk')
      .set('x-app-id', TEST_APP_ID)
      .attach('files', ONE_PIXEL_PNG, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .attach('files', Buffer.from('alert(1)'), {
        filename: 'bad.js',
        contentType: 'application/javascript',
      })
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ApiEnvelope<{
          successful: PublicFileMetadata[];
          failed: Array<{ code: string }>;
        }>;
        expect(body.data.successful).toHaveLength(1);
        expect(body.data.failed).toEqual([
          expect.objectContaining({ code: 'UNSUPPORTED_FILE_TYPE' }),
        ]);
      });
  });

  it('reads, downloads, soft-deletes, and recovers files in bulk', async () => {
    const fileIds: string[] = [];
    for (const filename of ['first.png', 'second.png']) {
      const response = await request(app.getHttpServer())
        .post('/files')
        .set('x-app-id', TEST_APP_ID)
        .attach('file', ONE_PIXEL_PNG, {
          filename,
          contentType: 'image/png',
        })
        .expect(201);
      const body = response.body as unknown as ApiEnvelope<PublicFileMetadata>;
      fileIds.push(body.data.fileId);
    }

    await request(app.getHttpServer())
      .post('/files/bulk/metadata')
      .set('x-app-id', TEST_APP_ID)
      .send({ fileIds })
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ApiEnvelope<{
          successful: PublicFileMetadata[];
          failed: unknown[];
        }>;
        expect(body.data.successful).toHaveLength(2);
        expect(body.data.failed).toEqual([]);
      });

    await request(app.getHttpServer())
      .post('/files/bulk/download')
      .set('x-app-id', TEST_APP_ID)
      .send({ fileIds })
      .expect('Content-Type', /application\/zip/)
      .expect('Content-Disposition', /files\.zip/)
      .expect(200);

    await request(app.getHttpServer())
      .delete('/files/bulk')
      .set('x-app-id', TEST_APP_ID)
      .send({ fileIds })
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ApiEnvelope<{
          successful: PublicFileMetadata[];
        }>;
        expect(body.data.successful).toHaveLength(2);
      });

    await request(app.getHttpServer())
      .post('/files/bulk/recover')
      .set('x-app-id', TEST_APP_ID)
      .send({ fileIds })
      .expect(200)
      .expect((response) => {
        const body = response.body as unknown as ApiEnvelope<{
          successful: PublicFileMetadata[];
        }>;
        expect(body.data.successful).toHaveLength(2);
      });
  });

  it('authorizes browser local upload and download without exposing the API key', async () => {
    await request(app.getHttpServer())
      .post('/files/authorizations/upload')
      .set('x-app-id', TEST_APP_ID)
      .send({ allowedMimeTypes: ['image/png'] })
      .expect(401);

    const uploadAuthorizationResponse = await request(app.getHttpServer())
      .post('/files/authorizations/upload')
      .set('x-app-id', TEST_APP_ID)
      .set('x-api-key', API_KEY)
      .send({
        maxSizeBytes: 1024,
        allowedMimeTypes: ['image/png'],
      })
      .expect('Cache-Control', 'no-store')
      .expect(201);
    const uploadAuthorization =
      uploadAuthorizationResponse.body as unknown as ApiEnvelope<{
        url: string;
        method: string;
        headers: { Authorization: string };
        requiresFinalization: boolean;
      }>;
    expect(uploadAuthorization.data.url).toBe(
      'http://localhost:7007/files/authorized-upload',
    );
    expect(uploadAuthorization.data.method).toBe('POST');
    expect(uploadAuthorization.data.requiresFinalization).toBe(false);
    expect(JSON.stringify(uploadAuthorization.data)).not.toContain(API_KEY);

    const authorizedUploadResponse = await request(app.getHttpServer())
      .post('/files/authorized-upload')
      .set(
        'authorization',
        uploadAuthorization.data.headers.Authorization,
      )
      .attach('file', ONE_PIXEL_PNG, {
        filename: 'direct-avatar.png',
        contentType: 'image/png',
      })
      .expect(201);
    const authorizedUpload =
      authorizedUploadResponse.body as unknown as ApiEnvelope<PublicFileMetadata>;
    const fileId = authorizedUpload.data.fileId;
    expect(authorizedUpload.data.appId).toBe(TEST_APP_ID);

    await request(app.getHttpServer())
      .post('/files/authorized-upload')
      .set(
        'authorization',
        uploadAuthorization.data.headers.Authorization,
      )
      .attach('file', ONE_PIXEL_PNG, {
        filename: 'replay.png',
        contentType: 'image/png',
      })
      .expect(409);

    const downloadAuthorizationResponse = await request(app.getHttpServer())
      .post(`/files/${fileId}/authorizations/download`)
      .set('x-app-id', TEST_APP_ID)
      .set('x-api-key', API_KEY)
      .expect(201);
    const downloadAuthorization =
      downloadAuthorizationResponse.body as unknown as ApiEnvelope<{
        headers: { Authorization: string };
      }>;

    await request(app.getHttpServer())
      .get('/files/507f1f77bcf86cd799439012/authorized-download')
      .set(
        'authorization',
        downloadAuthorization.data.headers.Authorization,
      )
      .expect(401);

    await request(app.getHttpServer())
      .get(`/files/${fileId}/authorized-download`)
      .set(
        'authorization',
        downloadAuthorization.data.headers.Authorization,
      )
      .expect('Content-Type', /image\/png/)
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
  });

  it('rejects oversized multipart files before application logic', async () => {
    await request(app.getHttpServer())
      .post('/files')
      .set('x-app-id', TEST_APP_ID)
      .attach('file', Buffer.alloc(1025), {
        filename: 'large.png',
        contentType: 'image/png',
      })
      .expect(413);
  });
});
