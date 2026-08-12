/**
 * Typed query helpers for Supabase (Phase 6).
 * Mock services are used until EXPO_PUBLIC_USE_MOCK_AUTH=false and Supabase is configured.
 */

export const profileSelect = 'id, email, full_name, phone, avatar_url, role, created_at' as const;

export const bookingSelect =
  'id, member_id, coach_id, starts_at, ends_at, status, location, notes, created_at' as const;

export const programSelect =
  'id, name, description, duration_weeks, coach_id, is_template, created_at, updated_at' as const;
