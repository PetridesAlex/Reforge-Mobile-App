import {
  AFTERNOON_530_MEMBER_IDS,
  AFTERNOON_630_MEMBER_IDS,
  MEMBER_IDS,
  mockBookings,
  mockClientPrograms,
  mockProfiles,
} from '@/services/mock/data';

export type NewsAudience = 'all' | 'class_530' | 'class_630' | 'private';

export type NewsAudienceOption = {
  id: NewsAudience;
  label: string;
  description: string;
  memberCount: number;
};

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function privatePtMemberIds(): string[] {
  const fromPrograms = mockClientPrograms.filter((p) => p.is_active).map((p) => p.client_id);
  const fromBookings = mockBookings
    .filter((b) => b.notes?.toLowerCase().includes('personal training'))
    .map((b) => b.member_id);
  return unique([...fromPrograms, ...fromBookings]);
}

export function resolveNewsAudienceMemberIds(audience: NewsAudience): string[] {
  const activeMembers = new Set(
    mockProfiles.filter((p) => p.role === 'member').map((p) => p.id),
  );

  const filterActive = (ids: readonly string[]) => ids.filter((id) => activeMembers.has(id));

  switch (audience) {
    case 'class_530':
      return filterActive(AFTERNOON_530_MEMBER_IDS);
    case 'class_630':
      return filterActive(AFTERNOON_630_MEMBER_IDS);
    case 'private':
      return filterActive(privatePtMemberIds());
    case 'all':
    default:
      return filterActive(MEMBER_IDS);
  }
}

export function newsAudienceOptions(): NewsAudienceOption[] {
  return [
    {
      id: 'all',
      label: 'All members',
      description: 'Everyone on the studio roster',
      memberCount: resolveNewsAudienceMemberIds('all').length,
    },
    {
      id: 'class_530',
      label: '5:30 class',
      description: 'Afternoon group · 5:30–6:30',
      memberCount: resolveNewsAudienceMemberIds('class_530').length,
    },
    {
      id: 'class_630',
      label: '6:30 class',
      description: 'Afternoon group · 6:30–7:30',
      memberCount: resolveNewsAudienceMemberIds('class_630').length,
    },
    {
      id: 'private',
      label: 'Private PT',
      description: '1-on-1 clients with programs or PT bookings',
      memberCount: resolveNewsAudienceMemberIds('private').length,
    },
  ];
}

export function newsAudienceLabel(audience: NewsAudience): string {
  return newsAudienceOptions().find((o) => o.id === audience)?.label ?? 'All members';
}

export function memberMatchesNewsAudience(memberId: string, audience: NewsAudience): boolean {
  return resolveNewsAudienceMemberIds(audience).includes(memberId);
}
