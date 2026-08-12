import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';

type RestTimerProps = {
  seconds: number;
  autoStart?: boolean;
  nextLabel?: string;
  onDone?: () => void;
  onSkip?: () => void;
};

export function RestTimer({
  seconds,
  autoStart = false,
  nextLabel,
  onDone,
  onSkip,
}: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(autoStart);
  const endsAtRef = useRef<number | null>(null);

  useEffect(() => {
    setRemaining(seconds);
    if (autoStart) {
      endsAtRef.current = Date.now() + seconds * 1000;
      setRunning(true);
    } else {
      endsAtRef.current = null;
      setRunning(false);
    }
  }, [seconds, autoStart]);

  useEffect(() => {
    if (!running) return;

    if (!endsAtRef.current) {
      endsAtRef.current = Date.now() + remaining * 1000;
    }

    const tick = () => {
      const endsAt = endsAtRef.current ?? Date.now();
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(next);
      if (next <= 0) {
        setRunning(false);
        endsAtRef.current = null;
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onDone?.();
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running, onDone, remaining]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && endsAtRef.current) {
        const next = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
        setRemaining(next);
        if (next <= 0) {
          setRunning(false);
          endsAtRef.current = null;
          onDone?.();
        }
      }
    });
    return () => sub.remove();
  }, [onDone]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const add30 = () => {
    const base = endsAtRef.current ?? Date.now() + remaining * 1000;
    endsAtRef.current = base + 30_000;
    setRemaining((r) => r + 30);
    setRunning(true);
  };

  const skip = () => {
    setRunning(false);
    endsAtRef.current = null;
    setRemaining(0);
    onSkip?.();
    onDone?.();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>REST</Text>
      <Text style={styles.time}>
        {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
      </Text>
      {nextLabel ? <Text style={styles.next}>Next: {nextLabel}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={add30} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
          <Text style={styles.btnText}>+30 SEC</Text>
        </Pressable>
        <Pressable
          onPress={skip}
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
          <Text style={[styles.btnText, styles.btnGhostText]}>SKIP</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (running) {
              endsAtRef.current = null;
              setRunning(false);
            } else {
              endsAtRef.current = Date.now() + remaining * 1000;
              setRunning(true);
            }
          }}
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
          <Text style={[styles.btnText, styles.btnGhostText]}>{running ? 'PAUSE' : 'START'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
  },
  time: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 58,
    color: colors.text,
    letterSpacing: 2,
  },
  next: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.background,
    letterSpacing: 0.6,
  },
  btnGhostText: {
    color: colors.text,
  },
  pressed: { opacity: 0.88 },
});
