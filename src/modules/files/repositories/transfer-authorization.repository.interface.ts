import {
  CreateTransferAuthorization,
  TransferOperation,
} from '../domain/transfer-authorization';

export const TRANSFER_AUTHORIZATION_REPOSITORY = Symbol(
  'TRANSFER_AUTHORIZATION_REPOSITORY',
);

export interface TransferAuthorizationRepository {
  create: (input: CreateTransferAuthorization) => Promise<void>;
  consume: (
    tokenIdHash: string,
    appId: string,
    operation: TransferOperation,
    usedAt: Date,
  ) => Promise<boolean>;
}
