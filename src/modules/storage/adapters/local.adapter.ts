import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  constants as fileSystemConstants,
  createReadStream,
  createWriteStream,
} from 'node:fs';
import { access, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { StorageConfiguration } from '../../../config/storage.config';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import {
  PutObjectInput,
  PutObjectResult,
  StorageHealthResult,
  StorageProvider,
  StorageReadResult,
} from '../interfaces/storage-provider.interface';

const SAFE_KEY_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function getNodeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  return typeof error.code === 'string' ? error.code : undefined;
}

@Injectable()
export class LocalStorageProvider implements StorageProvider, OnModuleInit {
  readonly name = 'local' as const;
  private readonly rootPath: string;

  constructor(configService: ConfigService) {
    const configuration =
      configService.getOrThrow<StorageConfiguration>('storage');
    this.rootPath = path.resolve(configuration.localRoot);
  }

  async onModuleInit(): Promise<void> {
    try {
      await mkdir(this.rootPath, { recursive: true });
      const rootStats = await stat(this.rootPath);
      if (!rootStats.isDirectory()) {
        throw new Error('Configured local storage root is not a directory');
      }
      await access(
        this.rootPath,
        fileSystemConstants.R_OK | fileSystemConstants.W_OK,
      );
    } catch (error) {
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'Local storage could not be initialized',
        { cause: error },
      );
    }
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const targetPath = this.resolveKey(input.key);

    try {
      await mkdir(path.dirname(targetPath), { recursive: true });

      if (Buffer.isBuffer(input.body)) {
        await writeFile(targetPath, input.body, { flag: 'wx' });
      } else {
        await pipeline(
          input.body,
          createWriteStream(targetPath, { flags: 'wx' }),
        );
      }

      const objectStats = await stat(targetPath);
      return { key: input.key, size: objectStats.size };
    } catch (error) {
      if (!Buffer.isBuffer(input.body)) {
        await this.removePartialObject(targetPath);
      }
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'The object could not be stored',
        { cause: error },
      );
    }
  }

  async openReadStream(key: string): Promise<StorageReadResult> {
    const targetPath = this.resolveKey(key);

    try {
      const objectStats = await stat(targetPath);
      if (!objectStats.isFile()) {
        throw new Error('Storage object is not a regular file');
      }
      return {
        stream: createReadStream(targetPath),
        size: objectStats.size,
      };
    } catch (error) {
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'The object could not be read',
        { cause: error },
      );
    }
  }

  async objectExists(key: string): Promise<boolean> {
    const targetPath = this.resolveKey(key);

    try {
      return (await stat(targetPath)).isFile();
    } catch (error) {
      if (getNodeErrorCode(error) === 'ENOENT') {
        return false;
      }
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'The object could not be checked',
        { cause: error },
      );
    }
  }

  async deleteObject(key: string): Promise<void> {
    const targetPath = this.resolveKey(key);

    try {
      await unlink(targetPath);
    } catch (error) {
      if (getNodeErrorCode(error) === 'ENOENT') {
        return;
      }
      throw new FileMediaError(
        FileMediaErrorCode.STORAGE_OPERATION_FAILED,
        'The object could not be deleted',
        { cause: error },
      );
    }
  }

  async checkHealth(): Promise<StorageHealthResult> {
    try {
      const rootStats = await stat(this.rootPath);
      await access(
        this.rootPath,
        fileSystemConstants.R_OK | fileSystemConstants.W_OK,
      );
      return { healthy: rootStats.isDirectory(), provider: this.name };
    } catch {
      return { healthy: false, provider: this.name };
    }
  }

  private resolveKey(key: string): string {
    if (
      key.length === 0 ||
      key.includes('\\') ||
      key.includes('\0') ||
      path.isAbsolute(key) ||
      /^[a-zA-Z]:/.test(key)
    ) {
      throw this.invalidKeyError();
    }

    const segments = key.split('/');
    if (
      segments.some(
        (segment) =>
          segment.length === 0 ||
          segment === '.' ||
          segment === '..' ||
          !SAFE_KEY_SEGMENT.test(segment),
      )
    ) {
      throw this.invalidKeyError();
    }

    const targetPath = path.resolve(this.rootPath, ...segments);
    const relativePath = path.relative(this.rootPath, targetPath);
    if (
      relativePath.length === 0 ||
      relativePath.startsWith(`..${path.sep}`) ||
      relativePath === '..' ||
      path.isAbsolute(relativePath)
    ) {
      throw this.invalidKeyError();
    }

    return targetPath;
  }

  private invalidKeyError(): FileMediaError {
    return new FileMediaError(
      FileMediaErrorCode.STORAGE_OPERATION_FAILED,
      'The storage key is invalid',
    );
  }

  private async removePartialObject(targetPath: string): Promise<void> {
    try {
      await unlink(targetPath);
    } catch (error) {
      if (getNodeErrorCode(error) !== 'ENOENT') {
        return;
      }
    }
  }
}
