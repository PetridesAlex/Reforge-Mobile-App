import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image, ImageContentFit, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, radius } from '@/constants/theme';

type MediaImageProps = {
  /** Remote URL, or local Metro asset (require / module id). */
  uri?: string | number | null;
  /** Prefer this when you already have a require() / ImageSource. */
  source?: ImageSource;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  rounded?: number;
  overlay?: boolean;
};

function resolveSource(
  source: ImageSource | undefined,
  uri: string | number | null | undefined,
): ImageSource | null {
  if (source != null) return source;
  if (typeof uri === 'number') return uri;
  if (typeof uri === 'string' && uri.length > 0) return { uri };
  return null;
}

/** Swap `uri` later for real REFORGE assets — keeps layout stable. */
export function MediaImage({
  uri,
  source,
  style,
  contentFit = 'cover',
  rounded = radius.lg,
  overlay = false,
}: MediaImageProps) {
  const resolved = resolveSource(source, uri);

  return (
    <View style={[styles.wrap, { borderRadius: rounded }, style]}>
      {resolved != null ? (
        <Image source={resolved} style={styles.image} contentFit={contentFit} transition={400} />
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
