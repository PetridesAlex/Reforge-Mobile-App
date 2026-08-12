import { Image, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius } from '@/constants/theme';

type ReforgeLogoProps = {
  width?: number;
  height?: number;
  /** compact = small wordmark; badge = framed brand mark for headers */
  variant?: 'wordmark' | 'badge';
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function ReforgeLogo({
  width = 180,
  height = 48,
  variant = 'wordmark',
  style,
  imageStyle,
}: ReforgeLogoProps) {
  if (variant === 'badge') {
    return (
      <View style={[styles.badge, { width, height }, style]}>
        <Image
          source={require('../../assets/images/reforge-logo.png')}
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
        source={require('../../assets/images/reforge-logo.png')}
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
    paddingHorizontal: 10,
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
