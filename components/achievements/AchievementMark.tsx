import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/constants/theme';

type Props = {
  name?: string | null;
  size?: number;
  color?: string;
};

/** Font-independent achievement marks — reliable on web + native. */
export function AchievementMark({ name, size = 22, color = colors.accent }: Props) {
  const key = (name ?? 'trophy').toLowerCase();
  const s = size;
  const stroke = color;

  if (key === 'flame' || key.includes('streak')) {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M12 3c1.5 3.2-.2 5.2-1.4 6.4C8.8 11.2 8 12.6 8 14.5 8 17.5 10 20 12 20s4-2.5 4-5.5c0-1.5-.5-2.7-1.2-3.7.9.3 1.7 1 2.2 2.1C18.2 11.2 17 7.8 12 3z"
          stroke={stroke}
          strokeWidth="1.6"
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (key === 'flash' || key.includes('session') || key.includes('workout')) {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M13 2 4 14h7l-1 8 10-14h-7l1-6z"
          stroke={stroke}
          strokeWidth="1.6"
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (key === 'trending-up' || key.includes('pr')) {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path d="M4 18 10 12l4 4 6-8" stroke={stroke} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M15 8h5v5" stroke={stroke} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (key === 'medal' || key === 'ribbon') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Circle cx="12" cy="9" r="4.2" stroke={stroke} strokeWidth="1.6" fill="none" />
        <Path d="M9.2 12.8 8 20l4-2.2L16 20l-1.2-7.2" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (key === 'star' || key === 'sparkles') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M12 3.5 13.9 9H20l-4.8 3.4L16.9 18 12 14.8 7.1 18l1.7-5.6L4 9h6.1L12 3.5z"
          stroke={stroke}
          strokeWidth="1.5"
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (key === 'people') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Circle cx="9" cy="8" r="2.6" stroke={stroke} strokeWidth="1.6" fill="none" />
        <Circle cx="16.5" cy="9" r="2.1" stroke={stroke} strokeWidth="1.5" fill="none" />
        <Path d="M4.5 18c.8-2.6 2.8-4 4.5-4s3.7 1.4 4.5 4" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <Path d="M14 14.2c1.1-.4 2.4-.3 3.5.5.9.7 1.5 1.8 1.8 3.3" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </Svg>
    );
  }

  // trophy default
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24">
      <Path d="M8 5h8v4.5c0 2.4-1.8 4.5-4 4.5s-4-2.1-4-4.5V5z" stroke={stroke} strokeWidth="1.6" fill="none" />
      <Path d="M8 7H5.8C5 7 4.5 7.7 4.8 8.4 5.4 10 6.6 11 8 11.4" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <Path d="M16 7h2.2c.8 0 1.3.7 1 1.4-.6 1.6-1.8 2.6-3.2 3" stroke={stroke} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <Path d="M12 14v3M9.5 19h5" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <Rect x="10" y="17" width="4" height="2" rx="0.5" stroke={stroke} strokeWidth="1.4" fill="none" />
    </Svg>
  );
}
