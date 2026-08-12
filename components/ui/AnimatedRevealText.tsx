import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  TextStyle,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type AnimatedRevealTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Delay before the first letter animates */
  delay?: number;
  /** Milliseconds between each letter */
  staggerMs?: number;
  /** Vertical travel distance on reveal */
  translateY?: number;
  /** Re-run the animation when this value changes */
  animateKey?: string | number;
};

export function AnimatedRevealText({
  text,
  style,
  containerStyle,
  delay = 0,
  staggerMs = 42,
  translateY = 14,
  animateKey = text,
}: AnimatedRevealTextProps) {
  const chars = useMemo(() => Array.from(text), [text]);
  const animsRef = useRef<Animated.Value[]>([]);

  if (animsRef.current.length !== chars.length) {
    animsRef.current = chars.map((_, index) => animsRef.current[index] ?? new Animated.Value(0));
  }

  useEffect(() => {
    const anims = animsRef.current.slice(0, chars.length);
    anims.forEach((anim) => anim.setValue(0));

    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.stagger(
        staggerMs,
        anims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            friction: 7,
            tension: 88,
            useNativeDriver: true,
          }),
        ),
      ),
    ]);

    animation.start();
    return () => animation.stop();
  }, [animateKey, chars.length, delay, staggerMs, text]);

  if (!text) return null;

  return (
    <View style={[styles.row, containerStyle]}>
      {chars.map((char, index) => {
        const anim = animsRef.current[index];
        const opacity = anim;
        const y = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [translateY, 0],
        });
        const scale = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.82, 1],
        });

        return (
          <Animated.Text
            key={`${animateKey}-${index}-${char}`}
            style={[style, { opacity, transform: [{ translateY: y }, { scale }] }]}>
            {char}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
});
