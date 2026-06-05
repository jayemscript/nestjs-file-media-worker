//src/common/interfaces/multer-file.interface.ts

export interface IMulterFile {
  size: number;
  originalname: string;
  mimetype: string;
  buffer?: Buffer;
  fieldname: string;
  encoding: string;
}