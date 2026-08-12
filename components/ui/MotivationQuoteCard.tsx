import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { MotivationQuote } from '@/lib/quotes/motivation';
import { colors, radius, spacing, typography } from '@/constants/theme';

type MotivationQuoteCardProps = {
  quote: MotivationQuote;
  onRequestNew?: () => void;
};

export function MotivationQuoteCard({ quote, onRequestNew }: MotivationQuoteCardProps) {
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.55)).current;
  const glow = useRef(new Animated.Value(0.35)).current;
  const markScale = useRef(new Animated.Value(1)).current;
  const [visibleText, setVisibleText] = useState(quote.text);
  const [visibleAuthor, setVisibleAuthor] = useState(quote.author);
  const [typing, setTyping] = useState(false);
  const caretBlink = useRef(new Animated.Value(1)).current;
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0.35,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    glowLoop.start();

    const caretLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(caretBlink, {
          toValue: 0,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(caretBlink, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
    );
    caretLoop.start();

    return () => {
      loop.stop();
      glowLoop.stop();
      caretLoop.stop();
    };
  }, [caretBlink, glow, pulse]);

  useEffect(() => {
    if (typeTimer.current) {
      clearInterval(typeTimer.current);
      typeTimer.current = null;
    }

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slide, {
        toValue: -8,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisibleText('');
      setVisibleAuthor(quote.author);
      setTyping(true);
      slide.setValue(10);
      fade.setValue(0);

      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(markScale, {
            toValue: 1.12,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(markScale, {
            toValue: 1,
            friction: 5,
            tension: 80,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Typewriter reveal
      let i = 0;
      const full = quote.text;
      typeTimer.current = setInterval(() => {
        i += 1;
        setVisibleText(full.slice(0, i));
        if (i >= full.length && typeTimer.current) {
          clearInterval(typeTimer.current);
          typeTimer.current = null;
          setTyping(false);
        }
      }, 16);
    });

    return () => {
      if (typeTimer.current) {
        clearInterval(typeTimer.current);
        typeTimer.current = null;
      }
    };
  }, [fade, markScale, quote.author, quote.text, slide]);

  const borderColor = glow.interpolate({
    inputRange: [0.35, 1],
    outputRange: ['rgba(200,255,0,0.28)', 'rgba(200,255,0,0.72)'],
  });

  const content = (
    <>
      <View style={styles.quoteHeader}>
        <Animated.View style={{ opacity: pulse, transform: [{ scale: pulse }] }}>
          <Ionicons name="flash" size={16} color={colors.accent} />
        </Animated.View>
        <Text style={styles.quoteEyebrow}>Daily drive</Text>
        {onRequestNew ? <Text style={styles.tapHint}>Tap for new</Text> : null}
      </View>

      <Animated.Text style={[styles.quoteMark, { transform: [{ scale: markScale }] }]}>
        “
      </Animated.Text>

      <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
        <Text style={styles.quoteText}>
          {visibleText}
          {typing ? (
            <Animated.Text style={[styles.caret, { opacity: caretBlink }]}>|</Animated.Text>
          ) : null}
        </Text>
        <Text style={styles.quoteAuthor}>— {visibleAuthor}</Text>
      </Animated.View>
    </>
  );

  if (onRequestNew) {
    return (
      <Pressable onPress={onRequestNew} style={({ pressed }) => [pressed && styles.pressed]}>
        <Animated.View style={[styles.quoteCard, { borderColor }]}>{content}</Animated.View>
      </Pressable>
    );
  }

  return <Animated.View style={[styles.quoteCard, { borderColor }]}>{content}</Animated.View>;
}

const styles = StyleSheet.create({
  quoteCard: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  quoteEyebrow: {
    ...typography.label,
    color: colors.accent,
    letterSpacing: 1.2,
  },
  tapHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  quoteMark: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.sm,
    fontSize: 64,
    lineHeight: 64,
    color: 'rgba(200,255,0,0.14)',
    fontWeight: '700',
  },
  quoteText: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
    paddingRight: spacing.lg,
    minHeight: 52,
  },
  caret: {
    color: colors.accent,
    opacity: 0.75,
    fontWeight: '400',
  },
  quoteAuthor: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
