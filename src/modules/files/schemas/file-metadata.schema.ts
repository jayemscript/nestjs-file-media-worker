import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FileStatus, FileType } from '../domain/file-metadata';

@Schema({ collection: 'files', timestamps: true, versionKey: false })
export class FileMetadataDocument {
  @Prop({ required: true, immutable: true, trim: true })
  appId!: string;

  @Prop({ required: true, immutable: true })
  originalName!: string;

  @Prop({ required: true, immutable: true })
  storageKey!: string;

  @Prop({
    required: true,
    immutable: true,
    type: String,
    enum: ['local', 's3'],
  })
  storageProvider!: 'local' | 's3';

  @Prop({
    required: true,
    immutable: true,
    type: String,
    enum: Object.values(FileType),
  })
  fileType!: FileType;

  @Prop({ required: true, immutable: true })
  mimeType!: string;

  @Prop({ required: true, immutable: true })
  extension!: string;

  @Prop({ required: true, immutable: true, min: 1 })
  size!: number;

  @Prop({ required: true, immutable: true })
  checksum!: string;

  @Prop({
    required: true,
    type: String,
    enum: Object.values(FileStatus),
    default: FileStatus.ACTIVE,
  })
  status!: FileStatus;

  @Prop()
  uploadedBy?: string;

  @Prop()
  deletedAt?: Date;

  @Prop()
  deletedBy?: string;

  @Prop()
  recoveredAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type FileMetadataHydratedDocument =
  HydratedDocument<FileMetadataDocument>;

export const FileMetadataSchema =
  SchemaFactory.createForClass(FileMetadataDocument);

FileMetadataSchema.index(
  { storageProvider: 1, storageKey: 1 },
  { unique: true },
);
FileMetadataSchema.index({ appId: 1, status: 1, createdAt: -1 });
