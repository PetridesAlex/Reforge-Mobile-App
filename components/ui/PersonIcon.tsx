import Svg, { Circle, Path } from 'react-native-svg';

type PersonIconProps = {
  size?: number;
  color?: string;
  filled?: boolean;
};

/** Font-independent person icon — reliable on web + native. */
export function PersonIcon({ size = 24, color = '#FFFFFF', filled = false }: PersonIconProps) {
  if (filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
        <Path
          fill={color}
          d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v1h14v-1c0-2.761-3.134-5-7-5z"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Circle cx="12" cy="8" r="3.25" stroke={color} strokeWidth="1.75" fill="none" />
      <Path
        d="M5.5 19.25c.7-3.1 3.2-5 6.5-5s5.8 1.9 6.5 5"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
