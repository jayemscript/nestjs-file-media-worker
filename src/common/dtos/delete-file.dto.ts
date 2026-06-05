//src/common/dtos/delete-file.dto.ts
export class DeleteFileDto {
  success!: boolean;
  message!: string;
  fileId!: string;
  deletedAt!: Date;
}