import { Image, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { radius } from '@/constants/theme';

const REFORGE_APP_ICON = require('../../assets/images/reforge-app-icon.png');

type ReforgeLogoProps = {
  /** Display size — official mark is square; keep width ≈ height. */
  width?: number;
  height?: number;
  /** compact = brand mark; badge = framed mark for headers */
  variant?: 'wordmark' | 'badge';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function ReforgeLogo({
  width = 120,
  height = 120,
  variant = 'wordmark',
  style,
  imageStyle,
}: ReforgeLogoProps) {
  if (variant === 'badge') {
    return (
      <View style={[styles.badge, { width, height }, style]}>
        <Image
          source={REFORGE_APP_ICON}
          style={[styles.badgeImage, imageStyle]}
          resizeMode="contain"
          accessibilityLabel="REFORGE"
        />
      </View>
    );
  }

  return (
    <View style={[{ width, height }, style]}>
      <Image
        source={REFORGE_APP_ICON}
        style={[styles.image, imageStyle]}
        resizeMode="contain"
        accessibilityLabel="REFORGE"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    borderRadius: radius.md,
    backgroundColor: '#0B0B0B',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeImage: {
    width: '100%',
    height: '100%',
  },
});
