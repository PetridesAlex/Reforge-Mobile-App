import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { sheetStyles } from '@/components/ui/AppBottomSheet';
import { formatTime } from '@/lib/utils/dates';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

export type StopwatchLap = {
  index: number;
  totalMs: number;
  splitMs: number;
};

type TimerMode = 'stopwatch' | 'countdown';

const COUNTDOWN_PRESETS_MIN = [5, 10, 15, 20, 30, 45, 60] as const;

type WorkoutStopwatchProps = {
  onFinish: (durationSeconds: number, laps: StopwatchLap[]) => Promise<void>;
  onProgramPress?: () => void;
  finishing?: boolean;
};

function formatMs(ms: number, showTenths = false): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safe % 1000) / 100);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (showTenths) {
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}.${tenths}`;
    return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
  }

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function WorkoutStopwatch({ onFinish, onProgramPress, finishing }: WorkoutStopwatchProps) {
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  const [countdownMinutes, setCountdownMinutes] = useState(20);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);
  const [laps, setLaps] = useState<StopwatchLap[]>([]);
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  const accumulatedMs = useRef(0);
  const resumeAt = useRef<number | null>(null);
  const lastLapMs = useRef(0);
  const countdownTotalMs = useRef(countdownMinutes * 60 * 1000);
  const doneRef = useRef(false);

  const getElapsedMs = useCallback(() => {
    const live = running && resumeAt.current != null ? Date.now() - resumeAt.current : 0;
    return accumulatedMs.current + live;
  }, [running, tick]);

  const getDisplayMs = useCallback(() => {
    if (mode === 'countdown') {
      return Math.max(0, countdownTotalMs.current - getElapsedMs());
    }
    return getElapsedMs();
  }, [mode, getElapsedMs, tick]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (mode !== 'countdown' || !running || doneRef.current) return;
    const remaining = countdownTotalMs.current - getElapsedMs();
    if (remaining <= 0) {
      doneRef.current = true;
      setDone(true);
      setRunning(false);
      if (resumeAt.current != null) {
        accumulatedMs.current += Date.now() - resumeAt.current;
        resumeAt.current = null;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [mode, running, tick, getElapsedMs]);

  const resetTimer = useCallback(() => {
    setRunning(false);
    setDone(false);
    doneRef.current = false;
    accumulatedMs.current = 0;
    resumeAt.current = null;
    lastLapMs.current = 0;
    setLaps([]);
    setStartedAt(null);
    setTick((t) => t + 1);
  }, []);

  const switchMode = (next: TimerMode) => {
    if (running) return;
    setMode(next);
    resetTimer();
    if (next === 'countdown') {
      countdownTotalMs.current = countdownMinutes * 60 * 1000;
    }
  };

  const selectCountdown = (minutes: number) => {
    if (running) return;
    setCountdownMinutes(minutes);
    countdownTotalMs.current = minutes * 60 * 1000;
    resetTimer();
  };

  const toggleRunning = () => {
    if (done && mode === 'countdown') return;

    if (!running) {
      if (!startedAt) setStartedAt(new Date());
      resumeAt.current = Date.now();
      setRunning(true);
      setDone(false);
      doneRef.current = false;
      return;
    }

    if (resumeAt.current != null) {
      accumulatedMs.current += Date.now() - resumeAt.current;
      resumeAt.current = null;
    }
    setRunning(false);
  };

  const recordLap = () => {
    if (!running && getElapsedMs() === 0) return;
    const totalMs = getElapsedMs();
    const splitMs = totalMs - lastLapMs.current;
    lastLapMs.current = totalMs;
    setLaps((prev) => [
      { index: prev.length + 1, totalMs, splitMs: prev.length === 0 ? totalMs : splitMs },
      ...prev,
    ]);
  };

  const handleFinish = async () => {
    if (resumeAt.current != null) {
      accumulatedMs.current += Date.now() - resumeAt.current;
      resumeAt.current = null;
    }
    const elapsedSeconds = Math.max(1, Math.round(accumulatedMs.current / 1000));
    setRunning(false);
    await onFinish(elapsedSeconds, laps);
  };

  const displayMs = getDisplayMs();
  const elapsedSeconds = Math.round(getElapsedMs() / 1000);
  const canLap = running || elapsedSeconds > 0;
  const canFinish = elapsedSeconds >= 1;

  return (
    <View style={styles.container}>
      <View style={styles.modeRow}>
        {(['stopwatch', 'countdown'] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => switchMode(item)}
            disabled={running}
            style={[styles.modeChip, mode === item && styles.modeChipActive, running && styles.modeChipDisabled]}>
            <Text style={[styles.modeChipText, mode === item && styles.modeChipTextActive]}>
              {item === 'stopwatch' ? 'Stopwatch' : 'Countdown'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'countdown' && !running && !startedAt ? (
        <View style={styles.presetBlock}>
          <Text style={sheetStyles.pickerLabel}>Duration</Text>
          <View style={sheetStyles.chipRow}>
            {COUNTDOWN_PRESETS_MIN.map((min) => (
              <Pressable
                key={min}
                onPress={() => selectCountdown(min)}
                style={[sheetStyles.chip, countdownMinutes === min && sheetStyles.chipActive]}>
                <Text style={[sheetStyles.chipText, countdownMinutes === min && sheetStyles.chipTextActive]}>
                  {min} min
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={[styles.displayCard, done && styles.displayCardDone]}>
        <Text style={styles.displayLabel}>
          {mode === 'countdown' ? (done ? "Time's up" : 'Remaining') : 'Elapsed'}
        </Text>
        <Text style={[styles.displayTime, done && styles.displayTimeDone]}>{formatMs(displayMs, running)}</Text>
        {startedAt ? (
          <View style={styles.startedRow}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.startedText}>Started {formatTime(startedAt.toISOString())}</Text>
          </View>
        ) : (
          <Text style={styles.startedHint}>Tap start when you&apos;re ready to train</Text>
        )}
      </View>

      <View style={styles.controlsRow}>
        <PrimaryButton
          title={running ? 'Pause' : done ? 'Done' : 'Start'}
          onPress={toggleRunning}
          disabled={finishing || (done && mode === 'countdown')}
          style={styles.controlBtn}
        />
        <PrimaryButton
          title="Lap"
          variant="secondary"
          onPress={recordLap}
          disabled={!canLap || finishing}
          style={styles.controlBtn}
        />
        <PrimaryButton
          title="Reset"
          variant="secondary"
          onPress={resetTimer}
          disabled={(!running && elapsedSeconds === 0 && laps.length === 0) || finishing}
          style={styles.controlBtn}
        />
      </View>

      {laps.length > 0 ? (
        <View style={styles.lapsCard}>
          <Text style={styles.lapsTitle}>Laps</Text>
          {laps.map((lap) => (
            <View key={lap.index} style={styles.lapRow}>
              <Text style={styles.lapIndex}>Lap {lap.index}</Text>
              <Text style={styles.lapTotal}>{formatMs(lap.totalMs, true)}</Text>
              <Text style={styles.lapSplit}>+{formatMs(lap.splitMs, true)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <PrimaryButton
        title={finishing ? 'Saving…' : 'Finish workout'}
        onPress={handleFinish}
        disabled={!canFinish || finishing}
        style={styles.finishBtn}
      />

      {onProgramPress ? (
        <Pressable onPress={onProgramPress} style={styles.programLink}>
          <Ionicons name="barbell-outline" size={16} color={colors.accent} />
          <Text style={styles.programLinkText}>Follow coach program instead</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  modeChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  modeChipDisabled: {
    opacity: 0.55,
  },
  modeChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  modeChipTextActive: {
    color: colors.accent,
    fontFamily: fonts.sansSemiBold,
  },
  presetBlock: {
    gap: spacing.sm,
  },
  displayCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
  },
  displayCardDone: {
    borderColor: 'rgba(74,222,128,0.35)',
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  displayLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  displayTime: {
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 66,
    letterSpacing: 2,
    color: colors.accent,
  },
  displayTimeDone: {
    color: colors.success,
  },
  startedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  startedText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  startedHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  lapsCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  lapsTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lapIndex: {
    ...typography.caption,
    color: colors.textMuted,
    width: 52,
  },
  lapTotal: {
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.sansSemiBold,
    flex: 1,
  },
  lapSplit: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: fonts.sansMedium,
  },
  finishBtn: {
    marginTop: spacing.xs,
  },
  programLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  programLinkText: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: fonts.sansMedium,
  },
});
