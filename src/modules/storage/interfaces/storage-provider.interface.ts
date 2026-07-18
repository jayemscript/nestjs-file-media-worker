import { Readable } from 'node:stream';

export type StorageProviderName = 'local' | 's3';

export interface PutObjectInput {
  key: string;
  body: Buffer | Readable;
}

export interface PutObjectResult {
  key: string;
  size: number;
}

export interface StorageReadResult {
  stream: Readable;
  size: number;
}

export interface StorageHealthResult {
  healthy: boolean;
  provider: StorageProviderName;
}

export interface StorageProvider {
  readonly name: StorageProviderName;
  putObject: (input: PutObjectInput) => Promise<PutObjectResult>;
  openReadStream: (key: string) => Promise<StorageReadResult>;
  objectExists: (key: string) => Promise<boolean>;
  deleteObject: (key: string) => Promise<void>;
  checkHealth: () => Promise<StorageHealthResult>;
}
