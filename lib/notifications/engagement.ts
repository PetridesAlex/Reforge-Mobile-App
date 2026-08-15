/**
 * Engagement notification stubs — wire to push/in-app prefs later.
 * Prefer quiet defaults; never spam.
 */
export type EngagementNoticeKind =
  | 'challenge_live'
  | 'rank_up'
  | 'beaten'
  | 'podium'
  | 'achievement'
  | 'challenge_ending';

export type EngagementNotice = {
  kind: EngagementNoticeKind;
  title: string;
  body: string;
  href?: string;
};

const PREF_KEY = 'reforge.engagement.notices.enabled';

export function engagementNoticesEnabled(): boolean {
  // Future: read from profile notification prefs / AsyncStorage
  return true;
}

export async function enqueueEngagementNotice(_notice: EngagementNotice): Promise<void> {
  if (!engagementNoticesEnabled()) return;
  // Phase 3: push into notifications table / Expo push
}
