import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { saveReadinessCheckin } from '@/services/engagement.supabase';
import { colors, fonts, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  memberId: string;
  sessionId?: string | null;
  onClose: () => void;
  onSaved?: (score: number) => void;
};

function ScoreRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pills}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <Text
            key={n}
            onPress={() => onChange(n)}
            style={[styles.pill, value === n && styles.pillOn]}>
            {n}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function ReadinessCheckInSheet({
  visible,
  memberId,
  sessionId,
  onClose,
  onSaved,
}: Props) {
  const [energy, setEnergy] = useState(7);
  const [sleep, setSleep] = useState(7);
  const [soreness, setSoreness] = useState(4);
  const [motivation, setMotivation] = useState(8);
  const [saving, setSaving] = useState(false);

  const score = useMemo(
    () => Math.round(((energy + sleep + (11 - soreness) + motivation) / 40) * 100),
    [energy, sleep, soreness, motivation],
  );

  const save = async () => {
    setSaving(true);
    try {
      const row = await saveReadinessCheckin({
        memberId,
        sessionId,
        energy,
        sleep_quality: sleep,
        soreness,
        motivation,
      });
      onSaved?.(row.score);
      onClose();
    } catch {
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} title="Readiness check-in">
      <Text style={styles.copy}>
        Optional pre-workout check. Score is informational only — your coach still owns programming.
      </Text>
      <Text style={styles.score}>{score}</Text>
      <Text style={styles.scoreLabel}>READINESS SCORE</Text>
      <ScoreRow label="Energy" value={energy} onChange={setEnergy} />
      <ScoreRow label="Sleep" value={sleep} onChange={setSleep} />
      <ScoreRow label="Soreness" value={soreness} onChange={setSoreness} />
      <ScoreRow label="Motivation" value={motivation} onChange={setMotivation} />
      <PrimaryButton
        title={saving ? 'Saving…' : 'Save check-in'}
        onPress={() => void save()}
        disabled={saving}
        style={{ marginTop: spacing.md }}
      />
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  copy: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 56,
    color: colors.accent,
    textAlign: 'center',
  },
  scoreLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  row: { marginBottom: spacing.md, gap: spacing.sm },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
    color: colors.textSecondary,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
  },
  pillOn: {
    backgroundColor: colors.accent,
    color: colors.background,
    borderColor: colors.accent,
  },
});
