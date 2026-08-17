import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { getFreshMotivationQuote } from '@/lib/quotes/motivation';
import type { MotivationQuote } from '@/lib/quotes/motivation';
import { colors, fonts, spacing } from '@/constants/theme';

type AppPreloadProps = {
  userName?: string | null;
  minDurationMs?: number;
  ready?: boolean;
  onExitComplete?: () => void;
};

const QUOTE_INTERVAL_MS = 2800;
const EXIT_DURATION_MS = 550;
const WELCOME_LINE = 'WELCOME TO';
const WELCOME_BACK_LINE = 'WELCOME BACK';
const BRAND_LINE = 'REFORGE';
const ANCHOR_LINE = 'STUDIO';

function firstNameFrom(fullName?: string | null) {
  if (!fullName?.trim()) return null;
  return fullName.trim().split(/\s+/)[0];
}

/** Sharp italic wordmark — matches store “REFORGE” line */
function BrandWordmark({
  text,
  delay = 0,
  accent = false,
}: {
  text: string;
  delay?: number;
  accent?: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.94)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(18);
    scale.setValue(0.94);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 72,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, opacity, scale, text, translateY]);

  return (
    <Animated.Text
      style={[
        styles.wordmark,
        accent && styles.wordmarkAccent,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.55}>
      {text}
    </Animated.Text>
  );
}

/** Heavy lime block — matches store “STORE” weight */
function BrandAnchor({ text, delay = 0 }: { text: string; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 9,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, opacity, text, translateY]);

  return (
    <Animated.Text
      style={[styles.anchor, { opacity, transform: [{ translateY }] }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}>
      {text}
    </Animated.Text>
  );
}

function WelcomeLine({ text, delay = 0 }: { text: string; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(10);
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, opacity, text, translateY]);

  return (
    <Animated.Text
      style={[styles.welcomeLine, { opacity, transform: [{ translateY }] }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}>
      {text}
    </Animated.Text>
  );
}

export function AppPreload({
  userName,
  minDurationMs = 7000,
  ready = false,
  onExitComplete,
}: AppPreloadProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [quote, setQuote] = useState<MotivationQuote>(() => getFreshMotivationQuote());
  const [quoteTick, setQuoteTick] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const exitStarted = useRef(false);
  const mountTime = useRef(Date.now());

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const underline = useRef(new Animated.Value(0)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const quoteY = useRef(new Animated.Value(12)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const rootScale = useRef(new Animated.Value(1)).current;

  const firstName = useMemo(() => firstNameFrom(userName), [userName]);
  const welcomeText = firstName ? WELCOME_BACK_LINE : WELCOME_LINE;
  const brandText = firstName ? firstName.toUpperCase() : BRAND_LINE;
  const showStudioAnchor = !firstName;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(underline, {
      toValue: 1,
      duration: 900,
      delay: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(barProgress, {
      toValue: 1,
      duration: minDurationMs,
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      useNativeDriver: false,
    }).start();

    Animated.sequence([
      Animated.delay(1100),
      Animated.parallel([
        Animated.timing(quoteOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(quoteY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [barProgress, logoOpacity, logoScale, minDurationMs, quoteOpacity, quoteY, underline]);

  useEffect(() => {
    const listenerId = barProgress.addListener(({ value }) => {
      setProgressPct(Math.min(100, Math.round(value * 100)));
    });
    return () => barProgress.removeListener(listenerId);
  }, [barProgress]);

  useEffect(() => {
    const id = setInterval(() => {
      setQuote((prev) => getFreshMotivationQuote(prev.text));
      setQuoteTick((n) => n + 1);
    }, QUOTE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    quoteOpacity.setValue(0);
    quoteY.setValue(10);
    Animated.parallel([
      Animated.timing(quoteOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(quoteY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [quoteTick, quoteOpacity, quoteY]);

  useEffect(() => {
    if (!ready || exitStarted.current) return;

    const elapsed = Date.now() - mountTime.current;
    const remaining = Math.max(0, minDurationMs - elapsed);

    const timer = setTimeout(() => {
      if (exitStarted.current) return;
      exitStarted.current = true;

      Animated.parallel([
        Animated.timing(rootOpacity, {
          toValue: 0,
          duration: EXIT_DURATION_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rootScale, {
          toValue: 1.04,
          duration: EXIT_DURATION_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onExitComplete?.();
      });
    }, remaining);

    return () => clearTimeout(timer);
  }, [minDurationMs, onExitComplete, ready, rootOpacity, rootScale]);

  const progressWidth = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const underlineScale = underline.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1],
  });

  const screenShell = useMemo(
    () => ({
      width: windowWidth,
      height: windowHeight,
      minHeight: windowHeight,
    }),
    [windowWidth, windowHeight],
  );

  return (
    <Animated.View
      style={[styles.root, screenShell, { opacity: rootOpacity, transform: [{ scale: rootScale }] }]}
      accessibilityLabel="Loading REFORGE">
      <View style={styles.center}>
        <Animated.View
          style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <ReforgeLogo width={148} height={148} />
        </Animated.View>

        <View style={styles.welcomeBlock}>
          <WelcomeLine text={welcomeText} delay={180} />
          <BrandWordmark text={brandText} delay={380} accent={Boolean(firstName)} />
          {showStudioAnchor ? <BrandAnchor text={ANCHOR_LINE} delay={560} /> : null}
          <Animated.View
            style={[
              styles.slash,
              { opacity: underline, transform: [{ scaleX: underlineScale }] },
            ]}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.barMeta}>
          <Text style={styles.loadingLabel}>LOADING</Text>
          <Text style={styles.progressPct}>{progressPct}%</Text>
        </View>

        <View style={styles.track}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        <Animated.View
          style={[styles.quoteBlock, { opacity: quoteOpacity, transform: [{ translateY: quoteY }] }]}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.quoteText}>{quote.text}</Text>
          <Text style={styles.quoteAuthor}>{quote.author.toUpperCase()}</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          minHeight: '100vh',
          height: '100vh',
        } as const)
      : null),
  },
  center: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    marginTop: -40,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  welcomeBlock: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: spacing.sm,
  },
  welcomeLine: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 4.2,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
    marginBottom: 6,
  },
  wordmark: {
    fontFamily: fonts.wordmark,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -0.5,
    color: colors.text,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
  },
  wordmarkAccent: {
    color: colors.accent,
  },
  anchor: {
    fontFamily: fonts.displayHeavy,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: 1,
    color: colors.accent,
    textAlign: 'center',
    textTransform: 'uppercase',
    width: '100%',
    marginTop: -4,
  },
  slash: {
    marginTop: spacing.md,
    width: 72,
    height: 3,
    backgroundColor: colors.accent,
  },
  footer: {
    position: 'absolute',
    bottom: 56,
    left: spacing.xl,
    right: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  barMeta: {
    width: '100%',
    maxWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadingLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: 'rgba(245,245,245,0.7)',
  },
  progressPct: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 1,
    color: colors.accent,
  },
  track: {
    width: '100%',
    maxWidth: 320,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  quoteBlock: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 8,
    minHeight: 92,
    justifyContent: 'flex-start',
  },
  quoteMark: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 28,
    color: colors.accent,
    opacity: 0.9,
  },
  quoteText: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  quoteAuthor: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.2,
    color: 'rgba(200,255,0,0.85)',
    textAlign: 'center',
  },
});
