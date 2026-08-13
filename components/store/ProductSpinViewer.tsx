import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  uris: string[];
  width: number;
  height?: number;
  alt?: string;
};

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function SpinGlyph({ color = colors.accent }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={1.6} fill="none" strokeDasharray="4 3.2" />
      <Path
        d="M17.2 6.2l1.6 3.2-3.2.4"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Premium product orbit viewer.
 * - 2+ frames: drag horizontally to scrub angles (wraps like a 360° spin)
 * - 1 frame: drag for a subtle 3D tilt / explore feel
 */
export function ProductSpinViewer({ uris, width, height = 420, alt }: Props) {
  const frames = useMemo(() => uris.filter(Boolean), [uris]);
  const frameKey = frames.join('|');
  const canSpin = frames.length > 1;
  const [frame, setFrame] = useState(0);
  const [hintVisible, setHintVisible] = useState(true);
  const startFrame = useSharedValue(0);
  const frameSV = useSharedValue(0);
  const dragX = useSharedValue(0);
  const hintOpacity = useSharedValue(1);
  const lastHapticFrame = useRef(0);

  useEffect(() => {
    setFrame(0);
    startFrame.value = 0;
    frameSV.value = 0;
    dragX.value = 0;
    setHintVisible(true);
    hintOpacity.value = 1;
  }, [dragX, frameKey, frameSV, hintOpacity, startFrame]);

  const bumpFrame = useCallback(
    (next: number) => {
      const wrapped = wrapIndex(next, frames.length);
      frameSV.value = wrapped;
      setFrame((prev) => {
        if (prev === wrapped) return prev;
        if (Platform.OS !== 'web' && lastHapticFrame.current !== wrapped) {
          lastHapticFrame.current = wrapped;
          void Haptics.selectionAsync();
        }
        return wrapped;
      });
    },
    [frameSV, frames.length],
  );

  const hideHint = useCallback(() => {
    if (!hintVisible) return;
    setHintVisible(false);
    hintOpacity.value = withTiming(0, { duration: 280 });
  }, [hintOpacity, hintVisible]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-18, 18])
        .onBegin(() => {
          startFrame.value = frameSV.value;
          runOnJS(hideHint)();
        })
        .onUpdate((e) => {
          dragX.value = e.translationX;
          if (!canSpin) return;
          const pixelsPerFrame = Math.max(18, width / (frames.length * 1.35));
          const moved = Math.round(-e.translationX / pixelsPerFrame);
          runOnJS(bumpFrame)(startFrame.value + moved);
        })
        .onEnd(() => {
          dragX.value = withSpring(0, { damping: 18, stiffness: 220 });
        }),
    [bumpFrame, canSpin, dragX, frameSV, frames.length, hideHint, startFrame, width],
  );

  const stageStyle = useAnimatedStyle(() => {
    if (canSpin) {
      const tilt = interpolate(dragX.value, [-120, 0, 120], [-4, 0, 4], Extrapolation.CLAMP);
      return {
        transform: [{ perspective: 900 }, { rotateY: `${tilt}deg` }],
      };
    }
    const rotateY = interpolate(dragX.value, [-160, 0, 160], [18, 0, -18], Extrapolation.CLAMP);
    const rotateX = interpolate(dragX.value, [-160, 0, 160], [2, 0, 2], Extrapolation.CLAMP);
    const scale = interpolate(Math.abs(dragX.value), [0, 160], [1, 1.03], Extrapolation.CLAMP);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
        { rotateX: `${rotateX}deg` },
        { scale },
      ],
    };
  });

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  if (frames.length === 0) {
    return <View style={[styles.placeholder, { width, height }]} />;
  }

  return (
    <GestureHandlerRootView style={{ width }}>
      <GestureDetector gesture={pan}>
        <View style={[styles.shell, { width, height }]}>
          <LinearGradient
            colors={['#141414', '#0A0A0A', '#050505']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(200,255,0,0.08)', 'transparent', 'rgba(0,0,0,0.45)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View style={[styles.stage, stageStyle]}>
            {frames.map((uri, index) => (
              <Image
                key={`${uri}-${index}`}
                source={{ uri }}
                style={[styles.image, index === frame ? styles.imageActive : styles.imageHidden]}
                contentFit="cover"
                accessibilityLabel={alt}
                transition={0}
                cachePolicy="memory-disk"
              />
            ))}
          </Animated.View>

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={styles.bottomFade}
            pointerEvents="none"
          />

          <View style={styles.badge} pointerEvents="none">
            <SpinGlyph />
            <Text style={styles.badgeText}>{canSpin ? '360°' : 'EXPLORE'}</Text>
          </View>

          <Animated.View style={[styles.hint, hintStyle]} pointerEvents="none">
            <Text style={styles.hintText}>{canSpin ? 'DRAG TO ROTATE' : 'DRAG TO EXPLORE'}</Text>
          </Animated.View>

          {canSpin ? (
            <View style={styles.ticks} pointerEvents="none">
              {frames.map((_, index) => (
                <View key={index} style={[styles.tick, index === frame && styles.tickActive]} />
              ))}
            </View>
          ) : null}

          {canSpin ? (
            <Text style={styles.counter} pointerEvents="none">
              {frame + 1} / {frames.length}
            </Text>
          ) : null}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.14)',
    backgroundColor: colors.surfaceElevated,
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageActive: {
    opacity: 1,
  },
  imageHidden: {
    opacity: 0,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
  },
  badge: {
    position: 'absolute',
    top: spacing.sm + 2,
    left: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  hint: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.2,
    color: 'rgba(245,245,245,0.88)',
  },
  ticks: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  tick: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tickActive: {
    backgroundColor: colors.accent,
    width: 16,
  },
  counter: {
    position: 'absolute',
    top: spacing.sm + 4,
    right: spacing.sm + 4,
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    color: 'rgba(245,245,245,0.7)',
  },
  placeholder: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
});
