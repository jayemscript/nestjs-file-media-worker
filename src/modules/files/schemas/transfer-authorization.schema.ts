import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TransferOperation } from '../domain/transfer-authorization';

@Schema({
  collection: 'transfer_authorizations',
  versionKey: false,
})
export class TransferAuthorizationDocument {
  @Prop({ required: true, immutable: true })
  tokenIdHash!: string;

  @Prop({ required: true, immutable: true, trim: true })
  appId!: string;

  @Prop({
    required: true,
    immutable: true,
    type: String,
    enum: Object.values(TransferOperation),
  })
  operation!: TransferOperation;

  @Prop({ required: true, immutable: true })
  expiresAt!: Date;

  @Prop()
  usedAt?: Date;

  @Prop({ required: true, immutable: true, default: Date.now })
  createdAt!: Date;
}

export type TransferAuthorizationHydratedDocument =
  HydratedDocument<TransferAuthorizationDocument>;

export const TransferAuthorizationSchema = SchemaFactory.createForClass(
  TransferAuthorizationDocument,
);

TransferAuthorizationSchema.index({ tokenIdHash: 1 }, { unique: true });
TransferAuthorizationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
