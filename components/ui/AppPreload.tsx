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
import { LinearGradient } from 'expo-linear-gradient';

import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { getFreshMotivationQuote } from '@/lib/quotes/motivation';
import type { MotivationQuote } from '@/lib/quotes/motivation';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type AppPreloadProps = {
  userName?: string | null;
  caption?: string;
  minDurationMs?: number;
  ready?: boolean;
  onExitComplete?: () => void;
};

const QUOTE_INTERVAL_MS = 2300;
const EXIT_DURATION_MS = 650;
const WORDMARK = 'REFORGE';
const LOADING_PHASES = [
  'Loading REFORGE',
  'Forging your studio',
  'Preparing training floor',
  'Almost ready',
] as const;

function firstNameFrom(fullName?: string | null) {
  if (!fullName?.trim()) return null;
  return fullName.trim().split(/\s+/)[0];
}

function ForgeWordmark({ glow }: { glow: Animated.Value }) {
  const letters = WORDMARK.split('');
  const letterAnims = useRef(letters.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const stagger = Animated.stagger(
      85,
      letterAnims.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ),
    );
    stagger.start();
    return () => stagger.stop();
  }, [letterAnims]);

  const glowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.75],
  });

  return (
    <View style={styles.wordmarkWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.wordmarkGlow,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />
      <View style={styles.wordmarkRow}>
        {letters.map((char, index) => {
          const anim = letterAnims[index];
          const opacity = anim;
          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [22, 0],
          });
          const scale = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.72, 1],
          });
          return (
            <Animated.Text
              key={`${char}-${index}`}
              style={[
                styles.wordmarkLetter,
                { opacity, transform: [{ translateY }, { scale }] },
              ]}>
              {char}
            </Animated.Text>
          );
        })}
      </View>
      <Animated.View
        style={[
          styles.wordmarkUnderline,
          {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
            transform: [
              {
                scaleX: glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

export function AppPreload({
  userName,
  caption = 'Limassol strength · precision training',
  minDurationMs = 7000,
  ready = false,
  onExitComplete,
}: AppPreloadProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [quote, setQuote] = useState<MotivationQuote>(() => getFreshMotivationQuote());
  const [quoteTick, setQuoteTick] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const exitStarted = useRef(false);
  const mountTime = useRef(Date.now());

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const logoBreathe = useRef(new Animated.Value(1)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordY = useRef(new Animated.Value(18)).current;
  const wordGlow = useRef(new Animated.Value(0)).current;
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeY = useRef(new Animated.Value(14)).current;
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const quoteY = useRef(new Animated.Value(10)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const rootScale = useRef(new Animated.Value(1)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const barPulse = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(0)).current;
  const orbDrift = useRef(new Animated.Value(0)).current;
  const orb2Drift = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;

  const firstName = useMemo(() => firstNameFrom(userName), [userName]);
  const loadingPhase = LOADING_PHASES[phaseIndex];

  useEffect(() => {
    const intro = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 42,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(wordY, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(welcomeOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(welcomeY, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(quoteOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(quoteY, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoBreathe, { toValue: 1.06, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(logoBreathe, { toValue: 0.97, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wordGlow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wordGlow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(barPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(barPulse, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );

    const dotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 0.2, duration: 600, useNativeDriver: true }),
      ]),
    );

    const orbLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbDrift, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orbDrift, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );

    const orb2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Drift, { toValue: 1, duration: 7800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orb2Drift, { toValue: 0, duration: 7800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );

    Animated.timing(barProgress, {
      toValue: 1,
      duration: minDurationMs,
      easing: Easing.bezier(0.22, 0.61, 0.36, 1),
      useNativeDriver: false,
    }).start();

    intro.start();
    breatheLoop.start();
    glowLoop.start();
    pulseLoop.start();
    shimmerLoop.start();
    dotLoop.start();
    orbLoop.start();
    orb2Loop.start();

    return () => {
      intro.stop();
      breatheLoop.stop();
      glowLoop.stop();
      pulseLoop.stop();
      shimmerLoop.stop();
      dotLoop.stop();
      orbLoop.stop();
      orb2Loop.stop();
    };
  }, [
    barProgress,
    barPulse,
    dotPulse,
    logoBreathe,
    logoOpacity,
    logoScale,
    minDurationMs,
    orb2Drift,
    orbDrift,
    quoteOpacity,
    quoteY,
    shimmerX,
    welcomeOpacity,
    welcomeY,
    wordGlow,
    wordOpacity,
    wordY,
  ]);

  useEffect(() => {
    const listenerId = barProgress.addListener(({ value }) => {
      setProgressPct(Math.min(100, Math.round(value * 100)));
    });
    return () => barProgress.removeListener(listenerId);
  }, [barProgress]);

  useEffect(() => {
    const id = setInterval(() => {
      setPhaseIndex((i) => (i + 1) % LOADING_PHASES.length);
    }, 1700);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setQuote((prev) => getFreshMotivationQuote(prev.text));
      setQuoteTick((n) => n + 1);
    }, QUOTE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    quoteOpacity.setValue(0);
    quoteY.setValue(8);
    Animated.parallel([
      Animated.timing(quoteOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(quoteY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
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
          toValue: 1.05,
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

  const shimmerTranslate = shimmerX.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 320],
  });

  const orbY = orbDrift.interpolate({ inputRange: [0, 1], outputRange: [0, -32] });
  const orbX = orbDrift.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const orb2Y = orb2Drift.interpolate({ inputRange: [0, 1], outputRange: [0, 24] });
  const orb2X = orb2Drift.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const dotOpacity = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
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
      <View style={[styles.backgroundShell, screenShell]} pointerEvents="none">
        <LinearGradient
          colors={['#121212', colors.background, '#040404']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.backgroundFill}
        />
        <LinearGradient
          colors={['rgba(200,255,0,0.11)', 'transparent', 'rgba(200,255,0,0.06)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.backgroundFill}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
          locations={[0.35, 0.72, 1]}
          style={styles.backgroundFill}
        />
      </View>
      <View style={styles.accentHairlineTop} pointerEvents="none" />

      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbPrimary, { transform: [{ translateY: orbY }, { translateX: orbX }] }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbSecondary, { transform: [{ translateY: orb2Y }, { translateX: orb2X }] }]}
      />

      <View style={styles.center}>
        <View style={styles.logoStage}>
          <Animated.View
            style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <Animated.View style={{ transform: [{ scale: logoBreathe }] }}>
              <ReforgeLogo width={360} height={96} />
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.wordBlock, { opacity: wordOpacity, transform: [{ translateY: wordY }] }]}>
          <Text style={styles.kicker}>STUDIO FLOOR</Text>
          <ForgeWordmark glow={wordGlow} />
          <Text style={styles.tagline}>STRENGTH · LIMASSOL</Text>
        </Animated.View>

        <Animated.View
          style={[styles.welcomeBlock, { opacity: welcomeOpacity, transform: [{ translateY: welcomeY }] }]}>
          <LinearGradient
            colors={['rgba(200,255,0,0.08)', 'rgba(200,255,0,0.02)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.welcomeGlow}
          />
          <Text style={styles.welcomeKicker}>{firstName ? 'MEMBER ACCESS' : 'STUDIO ACCESS'}</Text>
          {firstName ? (
            <View style={styles.welcomeTitleRow}>
              <Text style={styles.welcomeLead}>Welcome back,</Text>
              <Text style={styles.welcomeName}>{firstName}</Text>
            </View>
          ) : (
            <Text style={styles.welcomeBrand}>Welcome to REFORGE</Text>
          )}
          <View style={styles.welcomeRule} />
          <Text style={styles.caption}>
            {firstName ? 'Preparing your training floor…' : caption}
          </Text>
        </Animated.View>

        <Animated.View
          style={[styles.quoteCard, { opacity: quoteOpacity, transform: [{ translateY: quoteY }] }]}>
          <LinearGradient
            colors={['rgba(200,255,0,0.14)', 'rgba(200,255,0,0.04)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.quoteGlow}
          />
          <Text style={styles.quoteKicker}>TODAY&apos;S FOCUS</Text>
          <Text style={styles.quoteText}>&ldquo;{quote.text}&rdquo;</Text>
          <Text style={styles.quoteAuthor}>— {quote.author}</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerTop}>
          <View style={styles.loadingRow}>
            <Animated.View style={[styles.loadingDot, { opacity: dotOpacity }]} />
            <Text style={styles.loadingLabel}>{loadingPhase}</Text>
          </View>
          <Text style={styles.progressPct}>{progressPct}%</Text>
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.progressFill, { width: progressWidth, opacity: barPulse }]}>
            <Animated.View
              style={[styles.progressShimmer, { transform: [{ translateX: shimmerTranslate }] }]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>
        </View>
        <Text style={styles.footerBrand}>REFORGE · LIMASSOL</Text>
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
  backgroundShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    ...(Platform.OS === 'web'
      ? ({
          width: '100vw',
          minHeight: '100vh',
          height: '100vh',
        } as const)
      : null),
  },
  backgroundFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  accentHairlineTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(200,255,0,0.16)',
    zIndex: 1,
  },
  orb: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    zIndex: 1,
  },
  orbPrimary: {
    top: '8%',
    right: '-12%',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  orbSecondary: {
    bottom: '12%',
    left: '-14%',
    backgroundColor: 'rgba(200,255,0,0.05)',
  },
  center: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    zIndex: 1,
  },
  logoStage: {
    width: '100%',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordBlock: {
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  kicker: {
    ...typography.sectionKicker,
    fontSize: 10,
    marginBottom: 4,
  },
  wordmarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  wordmarkGlow: {
    position: 'absolute',
    width: 280,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  wordmarkLetter: {
    fontFamily: fonts.display,
    fontSize: 58,
    lineHeight: 60,
    letterSpacing: 1.5,
    color: colors.text,
    textTransform: 'uppercase',
  },
  wordmarkUnderline: {
    marginTop: 6,
    width: 120,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  tagline: {
    fontFamily: fonts.sansMedium,
    color: colors.textMuted,
    letterSpacing: 3.2,
    fontSize: 10,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  welcomeBlock: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    gap: spacing.xs,
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  welcomeGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  welcomeKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 2.4,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  welcomeTitleRow: {
    alignItems: 'center',
    gap: 0,
  },
  welcomeLead: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  welcomeName: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 52,
    letterSpacing: 2,
    color: colors.accent,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: -2,
  },
  welcomeBrand: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: 1.6,
    color: colors.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  welcomeRule: {
    width: 48,
    height: 2,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    marginVertical: spacing.xs,
    opacity: 0.85,
  },
  caption: {
    fontFamily: fonts.sansMedium,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    maxWidth: 300,
  },
  quoteCard: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: spacing.sm,
    minHeight: 108,
    justifyContent: 'center',
  },
  quoteGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  quoteKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 2.4,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  quoteText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  quoteAuthor: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    left: spacing.xl,
    right: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 1,
  },
  footerTop: {
    width: '100%',
    maxWidth: 300,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  loadingLabel: {
    fontFamily: fonts.sansSemiBold,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    fontSize: 11,
    textTransform: 'uppercase',
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
    maxWidth: 300,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    overflow: 'hidden',
  },
  progressShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
  },
  footerBrand: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 3,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
});
