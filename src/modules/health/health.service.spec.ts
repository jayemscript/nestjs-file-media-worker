import type { Connection } from 'mongoose';
import type { StorageProvider } from '../storage/interfaces/storage-provider.interface';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports ready when MongoDB and active storage are healthy', async () => {
    const connection = {
      readyState: 1,
      db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
    } as unknown as Connection;
    const storage = {
      checkHealth: jest
        .fn()
        .mockResolvedValue({ healthy: true, provider: 'local' }),
    } as unknown as StorageProvider;

    await expect(
      new HealthService(connection, storage).readiness(),
    ).resolves.toEqual({
      status: 'ready',
      dependencies: {
        mongodb: { status: 'up' },
        storage: { status: 'up', provider: 'local' },
      },
    });
  });

  it('reports not ready without exposing dependency details', async () => {
    const connection = { readyState: 0 } as Connection;
    const storage = {
      checkHealth: jest
        .fn()
        .mockResolvedValue({ healthy: false, provider: 'local' }),
    } as unknown as StorageProvider;

    await expect(
      new HealthService(connection, storage).readiness(),
    ).resolves.toEqual({
      status: 'not_ready',
      dependencies: {
        mongodb: { status: 'down' },
        storage: { status: 'down', provider: 'local' },
      },
    });
  });
});
