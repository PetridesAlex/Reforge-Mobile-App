import type { AuthSession } from '@/types';

function parseUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const paramString =
    hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : '';

  for (const part of paramString.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    const value = decodeURIComponent(part.slice(eq + 1));
    params[key] = value;
  }

  return params;
}

export function isAuthCallbackUrl(url: string): boolean {
  return url.includes('access_token=') || url.includes('code=') || url.includes('error=');
}

export { parseUrlParams };
