import { getSupabase } from '@/lib/supabase/client';

let schemaReadyCache: boolean | undefined;

export function isMissingMembershipTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === 'PGRST205' ||
    /member_memberships|membership_payments/.test(e.message ?? '')
  );
}

export async function isMembershipBillingReady(): Promise<boolean> {
  if (schemaReadyCache !== undefined) return schemaReadyCache;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('member_memberships').select('id').limit(1);
    if (error && isMissingMembershipTableError(error)) {
      schemaReadyCache = false;
      return false;
    }
    schemaReadyCache = !error;
    return schemaReadyCache;
  } catch {
    schemaReadyCache = false;
    return false;
  }
}

export function resetMembershipSchemaCache(): void {
  schemaReadyCache = undefined;
}

export const MEMBERSHIP_MIGRATION_HINT =
  'Run supabase/migrations/007_memberships.sql in the Supabase SQL Editor to enable billing.';
