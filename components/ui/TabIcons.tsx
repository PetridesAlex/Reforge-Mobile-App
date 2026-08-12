import { ReactNode, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors, fonts, radius } from '@/constants/theme';

type IconProps = { color: string; size?: number; filled?: boolean };

export function HomeTabIcon({ color, size = 22, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1v-9.5z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BarbellTabIcon({ color, size = 22, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3 9.5h2.2v5H3v-5zm15.8 0H21v5h-2.2v-5zM6.5 8h2v8h-2V8zm9 0h2v8h-2V8zM9.8 11h4.4v2H9.8v-2z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CalendarTabIcon({ color, size = 22, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x="3.5"
        y="5"
        width="17"
        height="15"
        rx="2.5"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.7}
        fillOpacity={filled ? 0.2 : 0}
      />
      <Path d="M3.5 9.5h17" stroke={color} strokeWidth={1.7} />
      <Path d="M8 3.5v3M16 3.5v3" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export function ChatTabIcon({ color, size = 22, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 5.8h14a1.7 1.7 0 0 1 1.7 1.7v7.2A1.7 1.7 0 0 1 19 16.4h-6.2L8.2 19.8v-3.4H5A1.7 1.7 0 0 1 3.3 14.7V7.5A1.7 1.7 0 0 1 5 5.8z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fillOpacity={filled ? 0.22 : 0}
      />
    </Svg>
  );
}

export function ProgressTabIcon({ color, size = 22, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 18V11" stroke={color} strokeWidth={filled ? 2.4 : 1.8} strokeLinecap="round" />
      <Path d="M12 18V6" stroke={color} strokeWidth={filled ? 2.4 : 1.8} strokeLinecap="round" />
      <Path d="M19 18v-8" stroke={color} strokeWidth={filled ? 2.4 : 1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function ProfileTabIcon({ color, size = 22, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle
        cx="12"
        cy="8"
        r="3.2"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.7}
      />
      <Path
        d="M5.2 19.2c.8-3.2 3.4-5 6.8-5s6 1.8 6.8 5"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function GridTabIcon({ color, size = 22, filled }: IconProps) {
  const o = filled ? 0.95 : 0;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="4" y="4" width="7" height="7" rx="1.5" fill={color} fillOpacity={o || 0} stroke={color} strokeWidth={1.6} />
      <Rect x="13" y="4" width="7" height="7" rx="1.5" fill={color} fillOpacity={o || 0} stroke={color} strokeWidth={1.6} />
      <Rect x="4" y="13" width="7" height="7" rx="1.5" fill={color} fillOpacity={o || 0} stroke={color} strokeWidth={1.6} />
      <Rect x="13" y="13" width="7" height="7" rx="1.5" fill={color} fillOpacity={o || 0} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function PeopleTabIcon({ color, size = 22, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="9" cy="8" r="2.6" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.6} />
      <Circle cx="16.5" cy="9" r="2.1" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.5} />
      <Path
        d="M3.8 18.5c.7-2.7 2.8-4.2 5.2-4.2s4.5 1.5 5.2 4.2"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M13.5 18.5c.4-1.8 1.7-3 3.4-3 1.5 0 2.7 1 3.2 2.5"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

type TabItemProps = {
  label: string;
  focused: boolean;
  children: ReactNode;
};

/** Premium tab chip: lime active glow, uppercase label, spring icon scale. */
export function TabItem({ label, focused, children }: TabItemProps) {
  const scale = useSharedValue(focused ? 1 : 0.94);
  const barWidth = useSharedValue(focused ? 20 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.94, { damping: 16, stiffness: 280 });
    barWidth.value = withTiming(focused ? 20 : 0, { duration: 220 });
  }, [barWidth, focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: barWidth.value,
    opacity: barWidth.value > 0 ? 1 : 0,
  }));

  return (
    <View style={styles.item}>
      <Animated.View style={[styles.iconWrap, focused && styles.iconWrapActive, iconStyle]}>
        {children}
      </Animated.View>
      <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
      <Animated.View style={[styles.activeBar, barStyle]} />
      {!focused ? <View style={styles.activeBarSpacer} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 38,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.42)',
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  labelActive: {
    color: colors.accent,
  },
  activeBar: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    marginTop: 1,
    shadowColor: colors.accent,
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  activeBarSpacer: {
    width: 20,
    height: 2,
    marginTop: 1,
  },
});
