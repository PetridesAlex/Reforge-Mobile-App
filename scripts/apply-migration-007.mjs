#!/usr/bin/env node
/**
 * Applies 007_memberships.sql when SUPABASE_DB_URL is set.
 *
 * Get the connection string from Supabase → Project Settings → Database → URI
 * (use the "Session pooler" connection string with your database password).
 *
 *   SUPABASE_DB_URL="postgresql://postgres.[ref]:[password]@...:5432/postgres" node scripts/apply-migration-007.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = join(root, 'supabase/migrations/007_memberships.sql');
const dbUrl = process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error(`
Missing SUPABASE_DB_URL.

1. Open Supabase → Project Settings → Database
2. Copy the Session pooler URI (replace [YOUR-PASSWORD])
3. Run:

   SUPABASE_DB_URL="postgresql://..." node scripts/apply-migration-007.mjs

Or paste the contents of supabase/migrations/007_memberships.sql into the SQL Editor.
`);
  process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf8');

try {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('Applied 007_memberships.sql successfully.');
} catch (e) {
  if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('Install pg first: npm install --save-dev pg');
    process.exit(1);
  }
  console.error('Migration failed:', e instanceof Error ? e.message : e);
  process.exit(1);
}
