import Svg, { Path } from 'react-native-svg';

type MenuIconProps = {
  size?: number;
  color?: string;
};

/** Font-independent hamburger — reliable on web + native. */
export function MenuIcon({ size = 20, color = '#C8FF00' }: MenuIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      <Path
        d="M4 7h16M4 12h16M4 17h16"
        stroke={color}
        strokeWidth="1.85"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
