//src/common/utils/generate-file-key.util.ts
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

export class GenerateFileKeyUtil {
  static generateFileKey(folderName: string, originalFileName: string): string {
    const fileExtension = path.extname(originalFileName);
    const uniqueId = uuidv4();
    const fileName = `${uniqueId}${fileExtension}`;
    return `${folderName}/${fileName}`;
  }

  static generateFileName(originalFileName: string): string {
    const fileExtension = path.extname(originalFileName);
    const uniqueId = uuidv4();
    return `${uniqueId}${fileExtension}`;
  }

  static extractFolderAndFileName(fileKey: string): {
    folder: string;
    fileName: string;
  } {
    const lastSlashIndex = fileKey.lastIndexOf('/');
    const folder = fileKey.substring(0, lastSlashIndex);
    const fileName = fileKey.substring(lastSlashIndex + 1);
    return { folder, fileName };
  }
}