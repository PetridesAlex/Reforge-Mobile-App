import type { AuthSession, Profile } from '@/types';
import { storageGet, storageRemove, storageSet } from '@/lib/utils/storage';
import { delay, mockPasswords, mockProfiles, newId } from '@/services/mock/data';

const SESSION_KEY = 'reforge.session';

export async function getSession(): Promise<AuthSession | null> {
  await delay(100);
  const raw = await storageGet(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function avatarKey(userId: string) {
  return `reforge.avatar.${userId}`;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  await delay(100);
  const profile = mockProfiles.find((p) => p.id === userId);
  if (!profile) return null;
  const storedAvatar = await storageGet(avatarKey(userId));
  if (storedAvatar) {
    profile.avatar_url = storedAvatar;
  }
  return { ...profile };
}

export async function signIn(email: string, password: string): Promise<{ session: AuthSession; profile: Profile }> {
  await delay(400);
  const normalized = email.trim().toLowerCase();
  const profile = mockProfiles.find((p) => p.email === normalized);
  if (!profile || mockPasswords[normalized] !== password) {
    throw new Error('Invalid email or password');
  }
  const session: AuthSession = {
    userId: profile.id,
    email: profile.email,
    accessToken: `mock-token-${profile.id}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  await storageSet(SESSION_KEY, JSON.stringify(session));
  const hydrated = (await getProfile(profile.id)) ?? profile;
  return { session, profile: hydrated };
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}): Promise<{ session: AuthSession; profile: Profile }> {
  await delay(500);
  const normalized = input.email.trim().toLowerCase();
  if (mockProfiles.some((p) => p.email === normalized)) {
    throw new Error('An account with this email already exists');
  }
  if (input.password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  const profile: Profile = {
    id: newId('user'),
    email: normalized,
    full_name: input.fullName.trim(),
    phone: input.phone?.trim() || null,
    avatar_url: null,
    role: 'member',
    created_at: new Date().toISOString(),
  };
  mockProfiles.push(profile);
  mockPasswords[normalized] = input.password;
  const session: AuthSession = {
    userId: profile.id,
    email: profile.email,
    accessToken: `mock-token-${profile.id}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  await storageSet(SESSION_KEY, JSON.stringify(session));
  return { session, profile };
}

export async function signOut(): Promise<void> {
  await delay(150);
  await storageRemove(SESSION_KEY);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await delay(400);
  const normalized = email.trim().toLowerCase();
  if (!mockProfiles.some((p) => p.email === normalized)) {
    // Don't reveal whether the email exists
    return;
  }
}

export async function updatePassword(password: string): Promise<void> {
  await delay(300);
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');
  if (password.length < 6) throw new Error('Password must be at least 6 characters');
  mockPasswords[session.email] = password;
}

export async function updateAvatar(userId: string, uri: string): Promise<Profile> {
  await delay(250);
  const profile = mockProfiles.find((p) => p.id === userId);
  if (!profile) throw new Error('Profile not found');
  profile.avatar_url = uri;
  await storageSet(avatarKey(userId), uri);
  return { ...profile };
}

export async function updateProfile(
  userId: string,
  patch: {
    fullName?: string;
    phone?: string | null;
    email?: string;
    communityBio?: string | null;
    communityMood?: string | null;
  },
): Promise<Profile> {
  await delay(250);
  const profile = mockProfiles.find((p) => p.id === userId);
  if (!profile) throw new Error('Profile not found');
  if (patch.fullName != null) {
    const name = patch.fullName.trim();
    if (!name) throw new Error('Name is required');
    profile.full_name = name;
  }
  if (patch.phone !== undefined) profile.phone = patch.phone?.trim() || null;
  if (patch.email != null) {
    const nextEmail = patch.email.trim().toLowerCase();
    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      throw new Error('Enter a valid email address');
    }
    profile.email = nextEmail;
  }
  if (patch.communityBio !== undefined) {
    const bio = patch.communityBio?.trim() || null;
    if (bio && bio.length > 280) throw new Error('Bio must be 280 characters or less');
    profile.community_bio = bio;
  }
  if (patch.communityMood !== undefined) {
    const mood = patch.communityMood?.trim() || null;
    profile.community_mood = mood;
    profile.community_mood_updated_at = mood ? new Date().toISOString() : null;
  }
  return { ...profile };
}
