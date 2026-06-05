//src/common/utils/file-hash.util.ts
import { createHash } from 'crypto';

export class FileHashUtil {
  static generateHash(
    fileBuffer: Buffer,
    algorithm: string = 'sha256',
  ): string {
    return createHash(algorithm).update(fileBuffer).digest('hex');
  }

  static validateHash(
    fileBuffer: Buffer,
    hash: string,
    algorithm: string = 'sha256',
  ): boolean {
    const generatedHash = this.generateHash(fileBuffer, algorithm);
    return generatedHash === hash;
  }
}