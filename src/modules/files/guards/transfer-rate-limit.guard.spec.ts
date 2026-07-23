import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileMediaErrorCode } from '../../../common/errors/file-media.error';
import { TransferConfiguration } from '../../../config/transfer.config';
import { TransferRateLimitGuard } from './transfer-rate-limit.guard';

function createContext(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, socket: {} }),
    }),
  } as unknown as ExecutionContext;
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw');
}

describe('TransferRateLimitGuard', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date('2026-07-23T00:00:00.000Z'),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('limits direct transfers per IP and resets after the window', () => {
    const configuration: TransferConfiguration = {
      enabled: true,
      publicBaseUrl: 'https://files.example.test',
      signingKey: 'test-transfer-signing-key-at-least-32-characters',
      tokenTtlSeconds: 300,
      rateLimitMax: 2,
      rateLimitWindowSeconds: 60,
    };
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(configuration),
    } as unknown as ConfigService;
    const guard = new TransferRateLimitGuard(configService);
    const context = createContext('192.0.2.1');

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(captureError(() => guard.canActivate(context))).toMatchObject({
      code: FileMediaErrorCode.TRANSFER_RATE_LIMIT_EXCEEDED,
    });

    jest.advanceTimersByTime(60_001);
    expect(guard.canActivate(context)).toBe(true);
  });
});
