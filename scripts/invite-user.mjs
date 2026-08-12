/**
 * Invite a member or coach by email (sends Supabase invite email).
 *
 * Requires in .env:
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Usage:
 *   npm run invite:user -- member friend@example.com "Maria Papadopoulou"
 *   npm run invite:user -- coach coach@example.com "Coach Name" --phone +35799123456
 *
 * Configure SMTP in Supabase Dashboard first (see supabase/README.md).
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

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const redirectTo = process.env.INVITE_REDIRECT_URL ?? 'reforge://reset-password';

const args = process.argv.slice(2);
const role = args[0] === 'coach' || args[0] === 'member' ? args.shift() : 'member';
const email = args[0]?.trim().toLowerCase();
const fullName = args[1]?.trim();
let phone = undefined;

for (let i = 2; i < args.length; i += 1) {
  if (args[i] === '--phone' && args[i + 1]) {
    phone = args[i + 1].trim();
    break;
  }
}

if (!url) fail('Missing EXPO_PUBLIC_SUPABASE_URL in .env');
if (!serviceKey) fail('Missing SUPABASE_SERVICE_ROLE_KEY in .env');
if (!email || !fullName) {
  fail('Usage: npm run invite:user -- [member|coach] email "Full Name" [--phone +357...]');
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing) {
    fail(`An account with ${email} already exists`);
  }

  const inviteRole = role === 'coach' ? 'coach' : 'member';

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      full_name: fullName,
      phone: phone ?? null,
      role: inviteRole,
    },
  });

  if (error) fail(error.message);
  if (!data.user) fail('Invite returned no user');

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone: phone ?? null,
      role: inviteRole,
    })
    .eq('id', data.user.id);

  if (profileError) fail(profileError.message);

  console.log('\n✅ Invite email sent');
  console.log(`   Email:  ${email}`);
  console.log(`   Name:   ${fullName}`);
  console.log(`   Role:   ${inviteRole}`);
  console.log(`   Link opens: ${redirectTo}`);
  console.log('\nAsk them to check inbox (and spam). They set their password from the email link.\n');
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
