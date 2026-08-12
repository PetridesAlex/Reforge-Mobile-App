export function formatSupabaseError(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
    return 'Network error — check your connection and try again';
  }
  if (error instanceof Error && error.message.trim()) {
    if (/failed to fetch/i.test(error.message)) {
      return 'Network error — check your connection and try again';
    }
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: unknown }).message);
    if (/failed to fetch/i.test(message)) {
      return 'Network error — check your connection and try again';
    }
    return message || fallback;
  }
  return fallback;
}
