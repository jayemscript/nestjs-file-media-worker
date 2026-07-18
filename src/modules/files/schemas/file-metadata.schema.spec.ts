import { Model, model, models } from 'mongoose';
import { FileStatus, FileType } from '../domain/file-metadata';
import {
  FileMetadataDocument,
  FileMetadataSchema,
} from './file-metadata.schema';

describe('FileMetadataSchema', () => {
  let metadataModel: Model<FileMetadataDocument>;

  beforeAll(() => {
    metadataModel =
      (models.FileMetadataSchemaTest as
        | Model<FileMetadataDocument>
        | undefined) ??
      model<FileMetadataDocument>('FileMetadataSchemaTest', FileMetadataSchema);
  });

  it('validates a complete metadata record', async () => {
    const document = new metadataModel({
      appId: 'merchant-portal',
      originalName: 'receipt.pdf',
      storageKey: 'merchant-portal/document/2026/07/id.pdf',
      storageProvider: 'local',
      fileType: FileType.DOCUMENT,
      mimeType: 'application/pdf',
      extension: 'pdf',
      size: 100,
      checksum: 'checksum',
    });

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.status).toBe(FileStatus.ACTIVE);
  });

  it('rejects an unsupported status', async () => {
    const document = new metadataModel({
      appId: 'merchant-portal',
      originalName: 'receipt.pdf',
      storageKey: 'merchant-portal/document/2026/07/id.pdf',
      storageProvider: 'local',
      fileType: FileType.DOCUMENT,
      mimeType: 'application/pdf',
      extension: 'pdf',
      size: 100,
      checksum: 'checksum',
      status: 'archived',
    });

    await expect(document.validate()).rejects.toThrow(
      '`archived` is not a valid enum value',
    );
  });

  it('declares the storage and scoped-query indexes', () => {
    const indexes = FileMetadataSchema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { storageProvider: 1, storageKey: 1 },
          expect.objectContaining({ unique: true }),
        ],
        [{ appId: 1, status: 1, createdAt: -1 }, expect.any(Object)],
      ]),
    );
  });
});
