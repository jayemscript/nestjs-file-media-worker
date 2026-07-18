import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Connection, Model, createConnection } from 'mongoose';
import {
  FileStatus,
  FileType,
} from '../src/modules/files/domain/file-metadata';
import { MongooseFileMetadataRepository } from '../src/modules/files/repositories/mongoose-file-metadata.repository';
import {
  FileMetadataDocument,
  FileMetadataSchema,
} from '../src/modules/files/schemas/file-metadata.schema';

const mongoUri = process.env.MONGO_TEST_URI ?? process.env.MONGO_URI;
const testDatabaseName =
  process.env.MONGO_TEST_DB_NAME ?? 'file_media_service_test';

if (!mongoUri) {
  throw new Error(
    'MONGO_TEST_URI or MONGO_URI is required for integration tests',
  );
}
if (!testDatabaseName.endsWith('_test')) {
  throw new Error('MONGO_TEST_DB_NAME must end in _test');
}

describe('MongooseFileMetadataRepository (integration)', () => {
  let connection: Connection;
  let metadataModel: Model<FileMetadataDocument>;
  let repository: MongooseFileMetadataRepository;
  let appId: string;

  beforeAll(async () => {
    connection = await createConnection(mongoUri, {
      dbName: testDatabaseName,
      maxPoolSize: 2,
    }).asPromise();
    metadataModel = connection.model<FileMetadataDocument>(
      'FileMetadataIntegration',
      FileMetadataSchema,
      'files',
    );
    repository = new MongooseFileMetadataRepository(metadataModel);
    await metadataModel.init();
  });

  beforeEach(() => {
    appId = `integration-${randomUUID()}`;
  });

  afterEach(async () => {
    if (metadataModel) {
      await metadataModel.deleteMany({ appId }).exec();
    }
  });

  afterAll(async () => {
    if (connection) {
      await connection.close();
    }
  });

  it('persists and scopes file metadata by appId', async () => {
    const created = await repository.create({
      appId,
      originalName: 'receipt.pdf',
      storageKey: `${appId}/document/2026/07/file.pdf`,
      storageProvider: 'local',
      fileType: FileType.DOCUMENT,
      mimeType: 'application/pdf',
      extension: 'pdf',
      size: 128,
      checksum: 'checksum',
    });

    await expect(
      repository.findActiveByIdAndAppId(created.id, appId),
    ).resolves.toMatchObject({ id: created.id, appId });
    await expect(
      repository.findActiveByIdAndAppId(created.id, 'other-app'),
    ).resolves.toBeNull();
  });

  it('uses atomic lifecycle transitions', async () => {
    const created = await repository.create({
      appId,
      originalName: 'avatar.png',
      storageKey: `${appId}/image/2026/07/file.png`,
      storageProvider: 'local',
      fileType: FileType.IMAGE,
      mimeType: 'image/png',
      extension: 'png',
      size: 128,
      checksum: 'checksum',
    });

    await expect(
      repository.markDeleted(created.id, appId, new Date()),
    ).resolves.toMatchObject({ status: FileStatus.DELETED });
    await expect(
      repository.recover(created.id, appId, new Date()),
    ).resolves.toMatchObject({ status: FileStatus.ACTIVE });
    await repository.markDeleted(created.id, appId, new Date());
    await expect(
      repository.claimForPurge(created.id, appId),
    ).resolves.toMatchObject({ status: FileStatus.PURGING });
    await expect(repository.deletePurging(created.id, appId)).resolves.toBe(
      true,
    );
  });
});
