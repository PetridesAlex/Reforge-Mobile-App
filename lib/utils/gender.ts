import { colors } from '@/constants/theme';
import type { MemberGender } from '@/types';

export function genderLabel(gender?: MemberGender | null): string {
  if (gender === 'female') return 'Woman';
  if (gender === 'male') return 'Man';
  if (gender === 'other') return 'Other';
  return 'Unspecified';
}

export function genderShort(gender?: MemberGender | null): string {
  if (gender === 'female') return 'F';
  if (gender === 'male') return 'M';
  return '—';
}

export function genderIcon(gender?: MemberGender | null): 'male-outline' | 'female-outline' | 'person-outline' {
  if (gender === 'female') return 'female-outline';
  if (gender === 'male') return 'male-outline';
  return 'person-outline';
}

export function genderTone(gender?: MemberGender | null) {
  if (gender === 'female') {
    return {
      border: 'rgba(244,114,182,0.45)',
      bg: 'rgba(244,114,182,0.12)',
      text: '#F472B6',
      pillBg: 'rgba(244,114,182,0.14)',
    };
  }
  if (gender === 'male') {
    return {
      border: 'rgba(96,165,250,0.45)',
      bg: 'rgba(96,165,250,0.12)',
      text: '#93C5FD',
      pillBg: 'rgba(96,165,250,0.14)',
    };
  }
  return {
    border: 'rgba(200,255,0,0.28)',
    bg: colors.accentMuted,
    text: colors.accent,
    pillBg: 'rgba(200,255,0,0.1)',
  };
}
