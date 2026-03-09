import { PublicClientApplication, type Configuration } from '@azure/msal-browser';

export function buildMsalConfig(): Configuration {
  const clientId = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID;
  if (!clientId) throw new Error('NEXT_PUBLIC_MSAL_CLIENT_ID is not set');

  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_MSAL_TENANT_ID ?? 'common'}`,
      redirectUri: process.env.NEXT_PUBLIC_MSAL_REDIRECT_URI,
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
  };
}

let msalInstance: PublicClientApplication | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(buildMsalConfig());
    await msalInstance.initialize();
  }
  return msalInstance;
}

export async function acquireMicrosoftToken(): Promise<string> {
  const instance = await getMsalInstance();
  const response = await instance.acquireTokenPopup({
    scopes: ['Calendars.Read'],
  });
  return response.accessToken;
}
