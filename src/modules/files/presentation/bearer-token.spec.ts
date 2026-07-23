import { extractBearerToken } from './bearer-token';

describe('extractBearerToken', () => {
  it('extracts a case-insensitive Bearer token', () => {
    expect(extractBearerToken('bearer signed-token')).toBe('signed-token');
  });

  it.each([
    undefined,
    '',
    'signed-token',
    'Basic signed-token',
    'Bearer one two',
  ])('rejects malformed authorization headers', (header) => {
    expect(extractBearerToken(header)).toBeUndefined();
  });
});
