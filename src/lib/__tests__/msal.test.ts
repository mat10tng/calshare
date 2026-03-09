import { buildMsalConfig } from '@/lib/msal';

describe('buildMsalConfig', () => {
  const originalClientId = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID;
  const originalTenantId = process.env.NEXT_PUBLIC_MSAL_TENANT_ID;
  const originalRedirectUri = process.env.NEXT_PUBLIC_MSAL_REDIRECT_URI;

  afterEach(() => {
    process.env.NEXT_PUBLIC_MSAL_CLIENT_ID = originalClientId;
    process.env.NEXT_PUBLIC_MSAL_TENANT_ID = originalTenantId;
    process.env.NEXT_PUBLIC_MSAL_REDIRECT_URI = originalRedirectUri;
  });

  test('throws when client ID is missing', () => {
    delete process.env.NEXT_PUBLIC_MSAL_CLIENT_ID;
    expect(() => buildMsalConfig()).toThrow('NEXT_PUBLIC_MSAL_CLIENT_ID is not set');
  });

  test('builds config with provided client ID', () => {
    process.env.NEXT_PUBLIC_MSAL_CLIENT_ID = 'test-client-id';
    const config = buildMsalConfig();
    expect(config.auth.clientId).toBe('test-client-id');
  });

  test('defaults to common tenant when tenant ID not set', () => {
    process.env.NEXT_PUBLIC_MSAL_CLIENT_ID = 'test-client-id';
    delete process.env.NEXT_PUBLIC_MSAL_TENANT_ID;
    const config = buildMsalConfig();
    expect(config.auth.authority).toBe('https://login.microsoftonline.com/common');
  });

  test('uses provided tenant ID in authority URL', () => {
    process.env.NEXT_PUBLIC_MSAL_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_MSAL_TENANT_ID = 'my-tenant';
    const config = buildMsalConfig();
    expect(config.auth.authority).toBe('https://login.microsoftonline.com/my-tenant');
  });

  test('includes redirect URI from env', () => {
    process.env.NEXT_PUBLIC_MSAL_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_MSAL_REDIRECT_URI = 'http://localhost:4000/availability/connect';
    const config = buildMsalConfig();
    expect(config.auth.redirectUri).toBe('http://localhost:4000/availability/connect');
  });
});
