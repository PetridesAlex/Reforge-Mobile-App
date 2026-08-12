/** True when Supabase studio tables/columns from migration 005 are not applied yet. */
export function isStudioSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; details?: string };
  const message = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase();
  return (
    e.code === '42P01' ||
    e.code === 'PGRST205' ||
    e.code === '42703' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache') ||
    message.includes('class_group')
  );
}

export async function withStudioFallback<T>(
  supabaseFn: () => Promise<T>,
  mockFn: () => T | Promise<T>,
): Promise<T> {
  try {
    return await supabaseFn();
  } catch (error) {
    if (isStudioSchemaError(error)) {
      return await mockFn();
    }
    throw error;
  }
}
