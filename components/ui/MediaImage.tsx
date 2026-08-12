import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image, ImageContentFit } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius } from '@/constants/theme';

type MediaImageProps = {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  rounded?: number;
  overlay?: boolean;
};

/** Swap `uri` later for real REFORGE assets — keeps layout stable. */
export function MediaImage({
  uri,
  style,
  contentFit = 'cover',
  rounded = radius.lg,
  overlay = false,
}: MediaImageProps) {
  return (
    <View style={[styles.wrap, { borderRadius: rounded }, style]}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} contentFit={contentFit} transition={250} />
      ) : (
        <View style={styles.fallback} />
      )}
      {overlay ? (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    backgroundColor: colors.border,
  },
});
