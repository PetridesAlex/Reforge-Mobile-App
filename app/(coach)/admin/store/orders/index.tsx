import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { StoreBadge } from '@/components/store/StoreBadge';
import { formatStoreMoney } from '@/lib/store/money';
import * as commerce from '@/services/store.commerce';
import type { StoreOrder, StoreOrderStatus } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const FILTERS: Array<{ id: StoreOrderStatus | 'all'; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'awaiting_payment', label: 'AWAITING' },
  { id: 'paid', label: 'PAID' },
  { id: 'processing', label: 'PROCESSING' },
  { id: 'ready_for_pickup', label: 'READY' },
  { id: 'shipped', label: 'SHIPPED' },
  { id: 'delivered', label: 'DONE' },
  { id: 'cancelled', label: 'CANCELLED' },
];

export default function AdminStoreOrdersScreen() {
  const [filter, setFilter] = useState<StoreOrderStatus | 'all'>('all');
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setOrders(await commerce.listAdminOrders(filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={40} width="40%" style={{ marginTop: spacing.md }} />
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
      <Text style={styles.title}>ORDERS</Text>

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

      {orders.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No orders"
          description="Member checkouts will appear here."
        />
      ) : (
        <View style={styles.list}>
          {orders.map((order) => (
            <Pressable
              key={order.id}
              style={styles.row}
              onPress={() => router.push(`/(coach)/admin/store/orders/${order.id}`)}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.orderNo}>{order.order_number}</Text>
                <Text style={styles.meta}>
                  {order.customer_name ?? 'Member'} · {order.contact_email} ·{' '}
                  {new Date(order.created_at).toLocaleDateString()}
                </Text>
                <Text style={styles.meta}>
                  {order.fulfillment_method.toUpperCase()} · {formatStoreMoney(order.total_cents)}
                  {order.contact_phone ? ` · ${order.contact_phone}` : ''}
                </Text>
                <View style={styles.badges}>
                  <StoreBadge label={order.status.replace(/_/g, ' ').toUpperCase()} />
                  <StoreBadge
                    label={order.payment_status.toUpperCase()}
                    tone={order.payment_status === 'paid' ? 'accent' : 'warn'}
                  />
                </View>
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
    color: colors.text,
    marginBottom: spacing.md,
  },
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
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  chipTextActive: { color: colors.accent },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderNo: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
});
