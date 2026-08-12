import type { User } from '@supabase/supabase-js';

import type { Profile } from '@/types';

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('GOOGLE_SIGN_IN_CANCELLED');
    this.name = 'GoogleSignInCancelledError';
  }
}

export function isGoogleSignInCancelled(error: unknown): boolean {
  return error instanceof GoogleSignInCancelledError;
}

type GoogleIdentity = {
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
};

export function extractGoogleIdentity(user: User): GoogleIdentity {
  const meta = user.user_metadata ?? {};
  const identities = user.identities ?? [];
  const googleIdentity = identities.find((identity) => identity.provider === 'google');
  const identityData =
    (googleIdentity?.identity_data as Record<string, unknown> | undefined) ?? meta;

  const fullName =
    pickString(meta.full_name) ??
    pickString(meta.name) ??
    pickString(identityData.full_name) ??
    pickString(identityData.name) ??
    null;

  const avatarUrl =
    pickString(meta.avatar_url) ??
    pickString(meta.picture) ??
    pickString(identityData.avatar_url) ??
    pickString(identityData.picture) ??
    null;

  return {
    fullName,
    avatarUrl,
    email: user.email ?? pickString(meta.email) ?? pickString(identityData.email),
  };
}

export function buildOAuthProfilePatch(
  existing: Profile,
  identity: GoogleIdentity,
): Record<string, string> {
  const patch: Record<string, string> = {};

  if (!existing.full_name?.trim() && identity.fullName?.trim()) {
    patch.full_name = identity.fullName.trim();
  }
  if (!existing.avatar_url && identity.avatarUrl) {
    patch.avatar_url = identity.avatarUrl;
  }
  if (!existing.email?.trim() && identity.email?.trim()) {
    patch.email = identity.email.trim();
  }

  return patch;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
