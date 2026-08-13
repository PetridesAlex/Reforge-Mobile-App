import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { formatStoreMoney } from '@/lib/store/money';
import * as commerce from '@/services/store.commerce';
import type { StoreOrder } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function MyOrdersScreen() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setOrders(await commerce.listMyOrders(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={40} width="40%" style={{ marginTop: spacing.md }} />
        <Skeleton height={80} style={{ marginTop: spacing.lg }} />
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
      <Text style={styles.kicker}>PROFILE</Text>
      <Text style={styles.title}>MY ORDERS</Text>

      {orders.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="NO ORDERS YET"
          description="Your REFORGE purchases will appear here."
          actionLabel="SHOP NOW"
          onAction={() => router.push('/(member)/store')}
        />
      ) : (
        <View style={styles.list}>
          {orders.map((order) => (
            <Pressable
              key={order.id}
              style={styles.row}
              onPress={() => router.push(`/(member)/store/orders/${order.id}`)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNo}>{order.order_number}</Text>
                <Text style={styles.meta}>
                  {new Date(order.created_at).toLocaleDateString()} ·{' '}
                  {formatStoreMoney(order.total_cents)}
                </Text>
                <Text style={styles.status}>{order.status.replace(/_/g, ' ').toUpperCase()}</Text>
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
    marginBottom: spacing.lg,
  },
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
  orderNo: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  status: {
    marginTop: 6,
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.accent,
  },
});
