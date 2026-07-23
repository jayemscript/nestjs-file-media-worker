import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import {
  CreateTransferAuthorization,
  TransferOperation,
} from '../domain/transfer-authorization';
import { TransferAuthorizationDocument } from '../schemas/transfer-authorization.schema';
import { TransferAuthorizationRepository } from './transfer-authorization.repository.interface';

@Injectable()
export class MongooseTransferAuthorizationRepository implements TransferAuthorizationRepository {
  constructor(
    @InjectModel(TransferAuthorizationDocument.name)
    private readonly model: Model<TransferAuthorizationDocument>,
  ) {}

  async create(input: CreateTransferAuthorization): Promise<void> {
    await this.execute(async () => {
      await new this.model(input).save();
    });
  }

  async consume(
    tokenIdHash: string,
    appId: string,
    operation: TransferOperation,
    usedAt: Date,
  ): Promise<boolean> {
    return this.execute(async () => {
      const result = await this.model
        .updateOne(
          {
            tokenIdHash,
            appId,
            operation,
            expiresAt: { $gt: usedAt },
            usedAt: null,
          },
          { $set: { usedAt } },
        )
        .exec();
      return result.modifiedCount === 1;
    });
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new FileMediaError(
        FileMediaErrorCode.PERSISTENCE_OPERATION_FAILED,
        'Transfer authorization could not be persisted',
        { cause: error },
      );
    }
  }
}
