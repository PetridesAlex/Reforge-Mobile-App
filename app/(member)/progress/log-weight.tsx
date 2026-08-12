import { router } from 'expo-router';
import { format } from 'date-fns';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { BackButton } from '@/components/ui/BackButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import * as memberService from '@/services/member';
import { colors, spacing, typography } from '@/constants/theme';

export default function LogWeightScreen() {
  const { profile } = useAuth();
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSave = async () => {
    if (!profile) return;
    const weightKg = Number(weight);
    if (!weightKg || weightKg <= 0) {
      setError('Enter a valid weight');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await memberService.logWeight({
        memberId: profile.id,
        weightKg,
        bodyFatPct: bodyFat ? Number(bodyFat) : undefined,
        measuredAt: date,
        notes: notes || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <BackButton label="Progress" style={styles.back} />
      <Text style={styles.title}>Log Weight</Text>
      <View style={styles.form}>
        <AppInput label="Weight (kg)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} placeholder="78.5" />
        <AppInput label="Body fat % (optional)" keyboardType="decimal-pad" value={bodyFat} onChangeText={setBodyFat} placeholder="14.2" />
        <AppInput label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <AppInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title={loading ? 'Saving…' : 'Save'} onPress={onSave} disabled={loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  back: {
    marginTop: spacing.sm,
  },
  title: {
    ...typography.hero,
    color: colors.text,
  },
  form: {
    gap: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
