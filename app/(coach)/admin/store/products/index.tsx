import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { StoreBadge } from '@/components/store/StoreBadge';
import { formatStoreMoney } from '@/lib/store/money';
import * as store from '@/services/store';
import type { StoreProduct, StoreProductStatus } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const FILTERS: Array<{ id: StoreProductStatus | 'all'; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'active', label: 'ACTIVE' },
  { id: 'draft', label: 'DRAFT' },
  { id: 'archived', label: 'ARCHIVED' },
];

export default function AdminStoreProductsScreen() {
  const [rows, setRows] = useState<StoreProduct[]>([]);
  const [filter, setFilter] = useState<StoreProductStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRows(await store.listProducts({ status: filter, sort: 'newest' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const countLabel = useMemo(() => `${rows.length} product${rows.length === 1 ? '' : 's'}`, [rows.length]);

  if (loading) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={36} width="40%" style={{ marginTop: spacing.md }} />
        <Skeleton height={80} style={{ marginTop: spacing.lg }} />
        <Skeleton height={80} style={{ marginTop: spacing.sm }} />
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
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>STORE</Text>
          <Text style={styles.title}>PRODUCTS</Text>
          <Text style={styles.meta}>{countLabel}</Text>
        </View>
        <PrimaryButton
          title="ADD"
          onPress={() => router.push('/(coach)/admin/store/products/new')}
          style={styles.addBtn}
        />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && styles.chipActive]}>
            <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 ? (
        <EmptyState
          icon="shirt-outline"
          title="No products"
          description="Add a product to start building the REFORGE catalogue."
          actionLabel="Add product"
          onAction={() => router.push('/(coach)/admin/store/products/new')}
        />
      ) : (
        <View style={styles.list}>
          {rows.map((p) => (
            <Pressable
              key={p.id}
              style={styles.row}
              onPress={() => router.push(`/(coach)/admin/store/products/${p.id}`)}>
              <MediaImage uri={p.primary_image_url} style={styles.thumb} rounded={radius.sm} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.sub}>
                  {p.category?.name ?? 'Uncategorized'} · {formatStoreMoney(p.price_cents)}
                </Text>
                <View style={styles.badgeRow}>
                  <StoreBadge
                    label={p.status.toUpperCase()}
                    tone={p.status === 'active' ? 'accent' : p.status === 'draft' ? 'warn' : 'muted'}
                  />
                  {p.featured ? <StoreBadge label="FEATURED" /> : null}
                  {p.is_bestseller ? <StoreBadge label="BEST SELLER" tone="accent" /> : null}
                  {p.is_best_of_month ? <StoreBadge label="BEST OF MONTH" tone="accent" /> : null}
                </View>
              </View>
              <View style={styles.stockCol}>
                <Text style={styles.stockNum}>{p.total_stock ?? 0}</Text>
                <Text style={styles.stockLbl}>units</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  kicker: {
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
  },
  addBtn: { minWidth: 88, paddingHorizontal: spacing.md },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  chipTextActive: { color: colors.accent },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 64, height: 80 },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  badgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  stockCol: { alignItems: 'flex-end', minWidth: 40 },
  stockNum: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  stockLbl: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textMuted,
  },
});
