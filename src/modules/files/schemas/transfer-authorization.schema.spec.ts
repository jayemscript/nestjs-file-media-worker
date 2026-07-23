import { Model, model, models } from 'mongoose';
import { TransferOperation } from '../domain/transfer-authorization';
import {
  TransferAuthorizationDocument,
  TransferAuthorizationSchema,
} from './transfer-authorization.schema';

describe('TransferAuthorizationSchema', () => {
  let authorizationModel: Model<TransferAuthorizationDocument>;

  beforeAll(() => {
    authorizationModel =
      (models.TransferAuthorizationSchemaTest as
        | Model<TransferAuthorizationDocument>
        | undefined) ??
      model<TransferAuthorizationDocument>(
        'TransferAuthorizationSchemaTest',
        TransferAuthorizationSchema,
      );
  });

  it('validates a replay-protection record', async () => {
    const document = new authorizationModel({
      tokenIdHash: 'a'.repeat(64),
      appId: 'admin-portal',
      operation: TransferOperation.UPLOAD,
      expiresAt: new Date('2026-07-23T00:05:00.000Z'),
    });

    await expect(document.validate()).resolves.toBeUndefined();
    expect(document.createdAt).toBeInstanceOf(Date);
  });

  it('declares unique token and TTL indexes', () => {
    expect(TransferAuthorizationSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ tokenIdHash: 1 }, expect.objectContaining({ unique: true })],
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
  });
});
