/**
 * Creates (or promotes) Andreas Petrides as REFORGE owner/admin.
 *
 * Requires in .env (never commit the service role key):
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (Supabase → Project Settings → API → service_role)
 *   SEED_ANDREAS_PASSWORD=...       (min 8 characters)
 *
 * Optional:
 *   SEED_ANDREAS_EMAIL=petrides_andreas@hotmail.com
 *
 * Run: npm run seed:andreas
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile(resolve(root, '.env'));

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_ANDREAS_PASSWORD;
const email = process.env.SEED_ANDREAS_EMAIL ?? 'petrides_andreas@hotmail.com';

const ANDREAS = {
  email,
  fullName: 'Andreas Petrides',
  phone: '+35799860056',
  role: 'admin',
};

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

if (!url) fail('Missing EXPO_PUBLIC_SUPABASE_URL in .env');
if (!serviceKey) {
  fail(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env from Supabase → Project Settings → API → service_role (secret).',
  );
}
if (!password || password.length < 8) {
  fail('Set SEED_ANDREAS_PASSWORD in .env (at least 8 characters) before running this script.');
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensureAdminProfile(userId) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: ANDREAS.email,
      full_name: ANDREAS.fullName,
      phone: ANDREAS.phone,
      role: ANDREAS.role,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

async function main() {
  console.log(`\nREFORGE · seeding admin: ${ANDREAS.email}\n`);

  const existing = await findUserByEmail(ANDREAS.email);

  if (existing) {
    console.log('User already exists — promoting profile to admin…');
    await ensureAdminProfile(existing.id);

    if (password) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
      if (error) throw error;
      console.log('Password updated.');
    }

    console.log('\n✅ Andreas admin profile is ready.');
    console.log(`   Email:    ${ANDREAS.email}`);
    console.log(`   Role:     admin`);
    console.log(`   Sign in on the app with the password you set in SEED_ANDREAS_PASSWORD.\n`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ANDREAS.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: ANDREAS.fullName,
      phone: ANDREAS.phone,
      role: ANDREAS.role,
    },
  });

  if (error) throw error;
  if (!data.user) fail('User creation returned no user.');

  await ensureAdminProfile(data.user.id);

  console.log('\n✅ Andreas admin account created.');
  console.log(`   Email:    ${ANDREAS.email}`);
  console.log(`   Password: (value of SEED_ANDREAS_PASSWORD in .env)`);
  console.log(`   Role:     admin → opens coach/owner app after sign in.\n`);
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err.message ?? err);
  process.exit(1);
});
