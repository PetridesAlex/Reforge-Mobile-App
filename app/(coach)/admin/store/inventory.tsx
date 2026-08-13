import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { StoreBadge } from '@/components/store/StoreBadge';
import * as store from '@/services/store';
import type { StoreInventoryReason, StoreProductVariant } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type InventoryRow = StoreProductVariant & {
  product_name: string;
  product_status: string;
};

export default function AdminStoreInventoryScreen() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [delta, setDelta] = useState('10');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<StoreInventoryReason>('restock');
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState<Awaited<ReturnType<typeof store.listVariantMovements>>>(
    [],
  );

  const load = useCallback(async () => {
    try {
      setError(null);
      const settings = await store.getInventorySettings();
      setThreshold(settings.low_stock_threshold);
      setRows(await store.listInventory());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdjust = async (row: InventoryRow) => {
    setSelected(row);
    setDelta('10');
    setNote('');
    setReason('restock');
    try {
      setMovements(await store.listVariantMovements(row.id));
    } catch {
      setMovements([]);
    }
  };

  const applyAdjust = async (sign: 1 | -1) => {
    if (!selected) return;
    const amount = Number(delta);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Enter a positive quantity');
      return;
    }
    setSaving(true);
    try {
      await store.adjustVariantStock({
        variantId: selected.id,
        delta: sign * Math.round(amount),
        reason: sign < 0 && reason === 'restock' ? 'adjustment' : reason,
        note: note.trim() || undefined,
      });
      setSelected(null);
      await load();
    } catch (e) {
      Alert.alert('Adjust failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={36} width="50%" style={{ marginTop: spacing.md }} />
        <Skeleton height={72} style={{ marginTop: spacing.lg }} />
        <Skeleton height={72} style={{ marginTop: spacing.sm }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <BackButton />
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.accent}
        />
      }>
      <BackButton />
      <Text style={styles.kicker}>STORE</Text>
      <Text style={styles.title}>INVENTORY</Text>
      <Text style={styles.meta}>Low stock threshold: {threshold}</Text>

      {rows.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="No variants"
          description="Generate product variants to track stock."
        />
      ) : (
        <View style={styles.list}>
          {rows.map((row) => {
            const low = row.stock_qty > 0 && row.stock_qty <= threshold;
            const out = row.stock_qty <= 0;
            return (
              <Pressable key={row.id} style={styles.row} onPress={() => void openAdjust(row)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{row.product_name}</Text>
                  <Text style={styles.sub}>
                    {[row.color_label, row.size_label].filter(Boolean).join(' / ') || row.sku}
                  </Text>
                  <Text style={styles.sku}>{row.sku}</Text>
                </View>
                <View style={styles.right}>
                  <Text
                    style={[
                      styles.qty,
                      out && { color: colors.danger },
                      low && { color: '#FACC15' },
                    ]}>
                    {row.stock_qty}
                  </Text>
                  {out ? <StoreBadge label="SOLD OUT" tone="danger" /> : null}
                  {low ? <StoreBadge label="LOW" tone="warn" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Modal visible={Boolean(selected)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selected?.product_name}</Text>
            <Text style={styles.modalSub}>
              {[selected?.color_label, selected?.size_label].filter(Boolean).join(' / ')} ·{' '}
              {selected?.stock_qty} in stock
            </Text>
            <AppInput label="Quantity" value={delta} onChangeText={setDelta} keyboardType="number-pad" />
            <AppInput label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
            <View style={styles.reasonRow}>
              {(['restock', 'adjustment', 'correction'] as StoreInventoryReason[]).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setReason(r)}
                  style={[styles.reasonChip, reason === r && styles.reasonActive]}>
                  <Text style={[styles.reasonText, reason === r && { color: colors.accent }]}>
                    {r.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <PrimaryButton
                title={saving ? '…' : '+ ADD'}
                onPress={() => void applyAdjust(1)}
                disabled={saving}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title={saving ? '…' : '− REMOVE'}
                onPress={() => void applyAdjust(-1)}
                disabled={saving}
                style={{ flex: 1, backgroundColor: colors.surfaceElevated }}
              />
            </View>
            <Pressable onPress={() => setSelected(null)} style={styles.close}>
              <Text style={styles.closeText}>CLOSE</Text>
            </Pressable>

            {movements.length > 0 ? (
              <View style={styles.history}>
                <Text style={styles.historyTitle}>RECENT MOVEMENTS</Text>
                {movements.slice(0, 8).map((m) => (
                  <Text key={m.id} style={styles.historyRow}>
                    {m.delta > 0 ? '+' : ''}
                    {m.delta} · {m.reason} · {new Date(m.created_at).toLocaleDateString()}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    marginTop: spacing.md,
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sku: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  right: { alignItems: 'flex-end', gap: 4 },
  qty: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
  },
  modalSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reasonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  reasonText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  close: { alignItems: 'center', padding: spacing.md },
  closeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  history: { marginTop: spacing.sm, gap: 4 },
  historyTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  historyRow: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
