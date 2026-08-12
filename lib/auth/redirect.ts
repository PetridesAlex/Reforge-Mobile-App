import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const APP_SCHEME = 'reforge';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function configuredSiteOrigin(): string | null {
  const raw = process.env.EXPO_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  return trimTrailingSlash(raw);
}

function webAuthCallbackUrl(): string | null {
  const configured = configuredSiteOrigin();
  if (configured) return `${configured}/auth/callback`;

  if (typeof window === 'undefined' || !window.location?.origin) return null;
  return `${window.location.origin}/auth/callback`;
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** Deep link Supabase redirects to after email confirm / OAuth / magic link / OTP. */
export function getAuthCallbackUrl(): string {
  if (Platform.OS === 'web') {
    return webAuthCallbackUrl() ?? `${APP_SCHEME}://auth/callback`;
  }

  // Expo Go always uses the exp:// deep link for the running dev server.
  if (isExpoGo()) {
    return Linking.createURL('auth/callback');
  }

  const customUri = makeRedirectUri({
    scheme: APP_SCHEME,
    path: 'auth/callback',
    preferLocalhost: false,
  });

  if (customUri.startsWith(`${APP_SCHEME}://`)) {
    return customUri;
  }

  return Linking.createURL('auth/callback');
}

export function getPasswordResetUrl(): string {
  if (Platform.OS === 'web') {
    const configured = configuredSiteOrigin();
    if (configured) return `${configured}/reset-password`;
    const origin = typeof window !== 'undefined' ? window.location?.origin : null;
    if (origin) return `${origin}/reset-password`;
  }

  if (isExpoGo()) {
    return Linking.createURL('reset-password');
  }

  const customUri = makeRedirectUri({
    scheme: APP_SCHEME,
    path: 'reset-password',
    preferLocalhost: false,
  });

  if (customUri.startsWith(`${APP_SCHEME}://`)) {
    return customUri;
  }

  return Linking.createURL('reset-password');
}

/** URLs passed to WebBrowser.openAuthSessionAsync must match redirectTo. */
export function getOAuthReturnUrl(): string {
  return getAuthCallbackUrl();
}

/** URLs to add in Supabase → Authentication → Redirect URLs. */
export function getSupabaseRedirectUrlHints(): string[] {
  const hints = new Set<string>([
    `${APP_SCHEME}://**`,
    `${APP_SCHEME}://auth/callback`,
    `${APP_SCHEME}://reset-password`,
    'exp://**',
  ]);

  const site = configuredSiteOrigin();
  if (site) {
    hints.add(`${site}/auth/callback`);
    hints.add(`${site}/**`);
    hints.add(`${site}/reset-password`);
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    hints.add(`${origin}/auth/callback`);
    hints.add(`${origin}/**`);
    hints.add(`${origin}/reset-password`);
  }

  hints.add('http://localhost:8081/auth/callback');
  hints.add('http://localhost:8081/**');

  return [...hints];
}
