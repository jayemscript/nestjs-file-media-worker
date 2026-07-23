import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key-guard';

function createContext(apiKey?: string, queryApiKey?: string): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({
        headers: apiKey ? { 'x-api-key': apiKey } : {},
        query: queryApiKey ? { api_key: queryApiKey } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  it('allows optional development requests when global enforcement is disabled', () => {
    const guard = createGuard(false);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('enforces an explicitly required API key even when globally disabled', () => {
    const guard = createGuard(true);

    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
    expect(guard.canActivate(createContext('registered-bff-key'))).toBe(true);
    expect(() =>
      guard.canActivate(createContext(undefined, 'registered-bff-key')),
    ).toThrow(UnauthorizedException);
  });
});

function createGuard(explicitlyRequired: boolean): ApiKeyGuard {
  const configService = {
    get: jest.fn((key: string, fallback: string) => {
      if (key === 'API_KEY_REQUIRED') {
        return 'false';
      }
      if (key === 'API_KEYS') {
        return 'registered-bff-key';
      }
      return fallback;
    }),
  } as unknown as ConfigService;
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(explicitlyRequired),
  } as unknown as Reflector;
  return new ApiKeyGuard(configService, reflector);
}
