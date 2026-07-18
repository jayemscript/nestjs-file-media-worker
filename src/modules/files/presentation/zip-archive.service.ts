import { Injectable } from '@nestjs/common';
import { PassThrough, Readable } from 'node:stream';
import { BulkDownloadEntry } from '../domain/file-operations';

@Injectable()
export class ZipArchiveService {
  async create(files: BulkDownloadEntry[]): Promise<Readable> {
    const { ZipArchive } = await import('archiver');
    const output = new PassThrough();
    const archive = new ZipArchive({ zlib: { level: 6 } });

    archive.on('warning', (error: Error) => output.destroy(error));
    archive.on('error', (error: Error) => output.destroy(error));
    archive.pipe(output);

    for (const file of files) {
      archive.append(file.stream, {
        name: this.createEntryName(file.fileId, file.originalName),
      });
    }

    void archive.finalize().catch((error: unknown) => {
      output.destroy(
        error instanceof Error
          ? error
          : new Error('The ZIP archive could not be finalized'),
      );
    });
    return output;
  }

  private createEntryName(fileId: string, originalName: string): string {
    const safeName = originalName.replaceAll('\\', '_').replaceAll('/', '_');
    return `${fileId}-${safeName || 'file'}`;
  }
}
