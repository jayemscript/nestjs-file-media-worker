import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Connection, Model, createConnection } from 'mongoose';
import {
  FileStatus,
  FileType,
} from '../src/modules/files/domain/file-metadata';
import { TransferOperation } from '../src/modules/files/domain/transfer-authorization';
import { MongooseFileMetadataRepository } from '../src/modules/files/repositories/mongoose-file-metadata.repository';
import { MongooseTransferAuthorizationRepository } from '../src/modules/files/repositories/mongoose-transfer-authorization.repository';
import {
  FileMetadataDocument,
  FileMetadataSchema,
} from '../src/modules/files/schemas/file-metadata.schema';
import {
  TransferAuthorizationDocument,
  TransferAuthorizationSchema,
} from '../src/modules/files/schemas/transfer-authorization.schema';

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
  let transferAuthorizationModel: Model<TransferAuthorizationDocument>;
  let repository: MongooseFileMetadataRepository;
  let transferRepository: MongooseTransferAuthorizationRepository;
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
    transferAuthorizationModel =
      connection.model<TransferAuthorizationDocument>(
        'TransferAuthorizationIntegration',
        TransferAuthorizationSchema,
        'transfer_authorizations',
      );
    transferRepository = new MongooseTransferAuthorizationRepository(
      transferAuthorizationModel,
    );
    await metadataModel.init();
    await transferAuthorizationModel.init();
  });

  beforeEach(() => {
    appId = `integration-${randomUUID()}`;
  });

  afterEach(async () => {
    if (metadataModel) {
      await metadataModel.deleteMany({ appId }).exec();
    }
    if (transferAuthorizationModel) {
      await transferAuthorizationModel.deleteMany({ appId }).exec();
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

  it('atomically consumes a transfer authorization once', async () => {
    const tokenIdHash = randomUUID().replaceAll('-', '').padEnd(64, '0');
    const usedAt = new Date();
    await transferRepository.create({
      tokenIdHash,
      appId,
      operation: TransferOperation.UPLOAD,
      expiresAt: new Date(usedAt.getTime() + 60_000),
    });

    await expect(
      transferRepository.consume(
        tokenIdHash,
        appId,
        TransferOperation.UPLOAD,
        usedAt,
      ),
    ).resolves.toBe(true);
    await expect(
      transferRepository.consume(
        tokenIdHash,
        appId,
        TransferOperation.UPLOAD,
        usedAt,
      ),
    ).resolves.toBe(false);
  });
});
