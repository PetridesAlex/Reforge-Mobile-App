import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** `require(...)` module or `{ uri }` */
  source: number | string | { uri: string };
  style?: StyleProp<ViewStyle>;
  /** Darken for readable foreground text */
  intensity?: 'soft' | 'strong';
  /** Slow Ken Burns drift */
  animate?: boolean;
};

/**
 * Full-bleed photo wash with brand-safe darkening — for cards and section heroes.
 */
export function AtmosphereBackdrop({
  source,
  style,
  intensity = 'strong',
  animate = true,
}: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!animate) return;
    scale.value = withRepeat(
      withTiming(1.08, { duration: 14000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [animate, scale]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const veil =
    intensity === 'soft'
      ? (['rgba(10,10,10,0.35)', 'rgba(10,10,10,0.72)', 'rgba(10,10,10,0.92)'] as const)
      : (['rgba(10,10,10,0.45)', 'rgba(10,10,10,0.82)', 'rgba(10,10,10,0.96)'] as const);

  const imageSource = typeof source === 'string' ? { uri: source } : source;

  return (
    <View pointerEvents="none" style={[styles.root, style]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.motionLayer, motion]}>
        <Image source={imageSource} style={styles.image} contentFit="cover" transition={400} />
      </Animated.View>
      <LinearGradient colors={[...veil]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(200,255,0,0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  motionLayer: {
    // Slight overscan so Ken Burns scale doesn't show edges
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
