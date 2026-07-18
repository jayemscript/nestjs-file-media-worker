import { ConfigService } from '@nestjs/config';
import { FileMediaErrorCode } from '../../../common/errors/file-media.error';
import { StorageConfiguration } from '../../../config/storage.config';
import { FileType } from '../domain/file-metadata';
import { FileValidationService } from './file-validation.service';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlS8qsAAAAASUVORK5CYII=',
  'base64',
);

function createService(maxFileSizeBytes = 1024): FileValidationService {
  const configuration: StorageConfiguration = {
    provider: 'local',
    localRoot: './upload',
    maxFileSizeBytes,
    maxBulkFileCount: 10,
    maxBulkTotalSizeBytes: 2048,
    allowedMimeTypes: ['image/png'],
    hardDeleteAdminKey: 'a-long-development-key',
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(configuration),
  } as unknown as ConfigService;
  return new FileValidationService(configService);
}

describe('FileValidationService', () => {
  it('uses detected content for MIME type, category, and extension', async () => {
    const result = await createService().validate({
      originalName: '../../avatar.exe',
      declaredMimeType: 'image/png',
      size: ONE_PIXEL_PNG.length,
      buffer: ONE_PIXEL_PNG,
    });

    expect(result).toMatchObject({
      originalName: 'avatar.exe',
      mimeType: 'image/png',
      extension: 'png',
      fileType: FileType.IMAGE,
      size: ONE_PIXEL_PNG.length,
    });
    expect(result.checksum).toMatch(/^[a-f\d]{64}$/);
  });

  it('rejects a declared MIME type that does not match the signature', async () => {
    await expect(
      createService().validate({
        originalName: 'avatar.jpg',
        declaredMimeType: 'image/jpeg',
        size: ONE_PIXEL_PNG.length,
        buffer: ONE_PIXEL_PNG,
      }),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.UNSUPPORTED_FILE_TYPE,
    });
  });

  it('rejects content without a recognized signature', async () => {
    await expect(
      createService().validate({
        originalName: 'script.js',
        declaredMimeType: 'application/javascript',
        size: 8,
        buffer: Buffer.from('alert(1)'),
      }),
    ).rejects.toMatchObject({
      code: FileMediaErrorCode.UNSUPPORTED_FILE_TYPE,
    });
  });

  it('rejects files above the configured size limit', async () => {
    await expect(
      createService(ONE_PIXEL_PNG.length - 1).validate({
        originalName: 'avatar.png',
        declaredMimeType: 'image/png',
        size: ONE_PIXEL_PNG.length,
        buffer: ONE_PIXEL_PNG,
      }),
    ).rejects.toMatchObject({ code: FileMediaErrorCode.FILE_TOO_LARGE });
  });

  it('generates a scoped opaque storage key', () => {
    const key = createService().generateStorageKey(
      'merchant-portal',
      { fileType: FileType.IMAGE, extension: 'png' },
      new Date('2026-07-18T00:00:00.000Z'),
    );

    expect(key).toMatch(
      /^merchant-portal\/image\/2026\/07\/[a-f\d-]{36}\.png$/,
    );
  });
});
