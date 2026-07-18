import { FileMediaError } from '../../../common/errors/file-media.error';
import { AppContextService } from './app-context.service';

describe('AppContextService', () => {
  const service = new AppContextService();

  it('accepts a lowercase application slug', () => {
    expect(service.requireAppId('merchant-portal')).toBe('merchant-portal');
  });

  it.each([
    undefined,
    '',
    'Merchant-Portal',
    '../merchant',
    ' merchant',
    'merchant_portal',
    'a'.repeat(64),
  ])('rejects unsafe application identifier %p', (appId) => {
    expect(() => service.requireAppId(appId)).toThrow(FileMediaError);
  });
});
