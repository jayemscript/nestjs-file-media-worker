import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { StorageConfiguration } from '../../../config/storage.config';
import { FileMediaError } from '../../../common/errors/file-media.error';
import { LocalStorageProvider } from './local.adapter';

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks);
}

describe('LocalStorageProvider', () => {
  let temporaryDirectory: string;
  let storageRoot: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'file-media-'));
    storageRoot = path.join(temporaryDirectory, 'nested', 'upload');
    const configuration: StorageConfiguration = {
      provider: 'local',
      localRoot: storageRoot,
      maxFileSizeBytes: 1024,
      maxBulkFileCount: 2,
      maxBulkTotalSizeBytes: 2048,
      allowedMimeTypes: ['image/png'],
      hardDeleteAdminKey: 'a-long-development-key',
    };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(configuration),
    } as unknown as ConfigService;

    provider = new LocalStorageProvider(configService);
    await provider.onModuleInit();
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('creates the configured root and reports healthy', async () => {
    await expect(provider.checkHealth()).resolves.toEqual({
      healthy: true,
      provider: 'local',
    });
  });

  it('stores a buffer without exposing its absolute path', async () => {
    const key = 'merchant-portal/image/2026/07/file.png';

    await expect(
      provider.putObject({ key, body: Buffer.from('image-bytes') }),
    ).resolves.toEqual({ key, size: 11 });
    await expect(
      readFile(path.join(storageRoot, ...key.split('/'))),
    ).resolves.toEqual(Buffer.from('image-bytes'));
  });

  it('stores and streams a readable body', async () => {
    const key = 'merchant-portal/document/2026/07/file.pdf';
    await provider.putObject({ key, body: Readable.from(['pdf-', 'bytes']) });

    const storedObject = await provider.openReadStream(key);

    expect(storedObject.size).toBe(9);
    await expect(readStream(storedObject.stream)).resolves.toEqual(
      Buffer.from('pdf-bytes'),
    );
  });

  it('refuses to overwrite an existing key', async () => {
    const key = 'merchant-portal/image/2026/07/file.png';
    await provider.putObject({ key, body: Buffer.from('first') });

    await expect(
      provider.putObject({ key, body: Buffer.from('second') }),
    ).rejects.toBeInstanceOf(FileMediaError);
    await expect(
      readFile(path.join(storageRoot, ...key.split('/'))),
    ).resolves.toEqual(Buffer.from('first'));
  });

  it.each([
    '../outside.txt',
    'merchant/../../outside.txt',
    'merchant\\..\\outside.txt',
    '/absolute/path.txt',
    'C:/absolute/path.txt',
    'merchant//file.txt',
  ])('rejects unsafe key %s', async (key) => {
    await expect(
      provider.putObject({ key, body: Buffer.from('unsafe') }),
    ).rejects.toBeInstanceOf(FileMediaError);
  });

  it('checks and idempotently deletes objects', async () => {
    const key = 'merchant-portal/image/2026/07/file.png';
    await provider.putObject({ key, body: Buffer.from('image') });

    await expect(provider.objectExists(key)).resolves.toBe(true);
    await provider.deleteObject(key);
    await expect(provider.objectExists(key)).resolves.toBe(false);
    await expect(provider.deleteObject(key)).resolves.toBeUndefined();
  });
});
