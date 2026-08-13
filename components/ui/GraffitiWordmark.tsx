import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/constants/theme';

type Props = {
  text: string;
  accent?: boolean;
  size?: number;
  delay?: number;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Premium graffiti lockup — staggered letter slam with slight tilt. */
export function GraffitiWordmark({
  text,
  accent = false,
  size = 64,
  delay = 0,
  animate = true,
  style,
}: Props) {
  const letters = text.toUpperCase().split('');
  const anims = useRef(letters.map(() => new Animated.Value(animate ? 0 : 1))).current;

  useEffect(() => {
    if (!animate) return;
    anims.forEach((a) => a.setValue(0));
    const timer = setTimeout(() => {
      Animated.stagger(
        48,
        anims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            friction: 6,
            tension: 95,
            useNativeDriver: true,
          }),
        ),
      ).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [animate, anims, delay, text]);

  return (
    <View style={[styles.row, style]}>
      {letters.map((char, index) => {
        const anim = anims[index];
        const isSpace = char === ' ';
        const restTilt = ((index % 5) - 2) * 1.4;
        const opacity = anim;
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [26, 0],
        });
        const rotate = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [`${index % 2 === 0 ? -10 : 10}deg`, `${restTilt}deg`],
        });
        const scale = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.68, 1],
        });

        return (
          <Animated.Text
            key={`${char}-${index}`}
            style={[
              styles.letter,
              accent ? styles.letterAccent : styles.letterBase,
              {
                fontSize: size,
                lineHeight: size + 2,
                marginHorizontal: isSpace ? size * 0.08 : -0.5,
                opacity,
                transform: [{ translateY }, { rotate }, { scale }],
              },
            ]}>
            {isSpace ? ' ' : char}
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
  letter: {
    fontFamily: fonts.display,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  letterBase: {
    color: colors.text,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 0,
  },
  letterAccent: {
    color: colors.accent,
    textShadowColor: 'rgba(200,255,0,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
});
