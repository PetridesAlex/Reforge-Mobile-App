import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import * as adminService from '@/services/admin';
import type { StudioSettings } from '@/services/mock/data';
import { colors, radius, spacing, typography } from '@/constants/theme';

const WEEK_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AdminSettingsScreen() {
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setSettings(await adminService.getStudioSettings());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleWorkingDay = (day: number) => {
    if (!settings) return;
    const workingDays = settings.workingDays.includes(day)
      ? settings.workingDays.filter((d) => d !== day)
      : [...settings.workingDays, day].sort((a, b) => a - b);
    setSettings({ ...settings, workingDays });
  };

  const onSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      setSettings(await adminService.updateStudioSettings(settings));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={160} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error && !settings) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  if (!settings) return null;

  return (
    <Screen>
      <PrimaryButton title="← Studio" variant="ghost" onPress={() => router.back()} style={styles.back} />
      <Text style={styles.kicker}>STUDIO CONTROL</Text>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Brand, working week, hours, and member access</Text>

      <AppCard style={styles.card}>
        <AppInput
          label="Studio name"
          value={settings.name}
          onChangeText={(name) => setSettings({ ...settings, name })}
        />
        <AppInput
          label="Location"
          value={settings.location}
          onChangeText={(location) => setSettings({ ...settings, location })}
        />
        <AppInput
          label="Membership label"
          value={settings.membershipLabel}
          onChangeText={(membershipLabel) => setSettings({ ...settings, membershipLabel })}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.sectionLabel}>Working / training days</Text>
        <Text style={styles.help}>Tap days the studio is open for training</Text>
        <View style={styles.weekRow}>
          {WEEK_SHORT.map((label, idx) => {
            const on = settings.workingDays.includes(idx);
            return (
              <Pressable
                key={label}
                onPress={() => toggleWorkingDay(idx)}
                style={[styles.weekChip, on && styles.weekChipOn]}>
                <Text style={[styles.weekChipText, on && styles.weekChipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.hoursRow}>
          <View style={styles.hoursField}>
            <AppInput
              label="Opens"
              value={settings.openTime}
              onChangeText={(openTime) => setSettings({ ...settings, openTime })}
              placeholder="07:00"
            />
          </View>
          <View style={styles.hoursField}>
            <AppInput
              label="Closes"
              value={settings.closeTime}
              onChangeText={(closeTime) => setSettings({ ...settings, closeTime })}
              placeholder="21:00"
            />
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.sectionLabel}>Access</Text>
        <ToggleRow
          label="Member self-booking"
          value={settings.allowMemberBooking}
          onToggle={() =>
            setSettings({ ...settings, allowMemberBooking: !settings.allowMemberBooking })
          }
        />
        <ToggleRow
          label="Group chat"
          value={settings.groupChatEnabled}
          onToggle={() =>
            setSettings({ ...settings, groupChatEnabled: !settings.groupChatEnabled })
          }
        />
      </AppCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.saved}>Settings saved</Text> : null}

      <PrimaryButton title={saving ? 'Saving…' : 'Save settings'} onPress={onSave} disabled={saving} />
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <Text style={[styles.toggleText, value && styles.toggleTextOn]}>{value ? 'ON' : 'OFF'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.sm },
  kicker: { ...typography.label, color: colors.accent },
  title: { ...typography.hero, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md, gap: spacing.md },
  sectionLabel: { ...typography.label, color: colors.textMuted },
  help: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.sm },
  weekRow: { flexDirection: 'row', gap: 4 },
  weekChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  weekChipOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  weekChipText: { ...typography.label, color: colors.textMuted, fontSize: 10 },
  weekChipTextOn: { color: colors.accent },
  hoursRow: { flexDirection: 'row', gap: spacing.sm },
  hoursField: { flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  toggleLabel: { ...typography.body, color: colors.text },
  toggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    minWidth: 56,
    alignItems: 'center',
  },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  toggleText: { ...typography.label, color: colors.textMuted },
  toggleTextOn: { color: colors.accent },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  saved: { ...typography.caption, color: colors.success, marginBottom: spacing.sm },
});
