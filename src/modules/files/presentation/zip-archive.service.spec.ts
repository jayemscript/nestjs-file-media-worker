import { Readable } from 'node:stream';
import { BulkDownloadEntry } from '../domain/file-operations';
import { ZipArchiveService } from './zip-archive.service';

const FILE_ID = '507f1f77bcf86cd799439011';

function collect(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

describe('ZipArchiveService', () => {
  it('creates a ZIP with an app-owned unique entry name', async () => {
    const file: BulkDownloadEntry = {
      fileId: FILE_ID,
      originalName: '../avatar.png',
      mimeType: 'image/png',
      size: 7,
      stream: Readable.from('content'),
    };

    const archiveStream = await new ZipArchiveService().create([file]);
    const archive = await collect(archiveStream);

    expect(archive.subarray(0, 2).toString()).toBe('PK');
    expect(archive.includes(Buffer.from(`${FILE_ID}-.._avatar.png`))).toBe(
      true,
    );
  });
});
