import { Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { StorageProvider } from '../storage/interfaces/storage-provider.interface';
import { STORAGE_PROVIDER } from '../storage/storage.constants';

export interface DependencyHealth {
  status: 'up' | 'down';
}

export interface StorageDependencyHealth extends DependencyHealth {
  provider: string;
}

export interface ReadinessResult {
  status: 'ready' | 'not_ready';
  dependencies: {
    mongodb: DependencyHealth;
    storage: StorageDependencyHealth;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: StorageProvider,
  ) {}

  liveness(): { status: 'alive' } {
    return { status: 'alive' };
  }

  async readiness(): Promise<ReadinessResult> {
    const [mongodbHealthy, storageHealth] = await Promise.all([
      this.checkMongoDb(),
      this.storageProvider.checkHealth(),
    ]);
    const ready = mongodbHealthy && storageHealth.healthy;

    return {
      status: ready ? 'ready' : 'not_ready',
      dependencies: {
        mongodb: { status: mongodbHealthy ? 'up' : 'down' },
        storage: {
          status: storageHealth.healthy ? 'up' : 'down',
          provider: storageHealth.provider,
        },
      },
    };
  }

  private async checkMongoDb(): Promise<boolean> {
    if (Number(this.connection.readyState) !== 1 || !this.connection.db) {
      return false;
    }

    try {
      await this.connection.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}
