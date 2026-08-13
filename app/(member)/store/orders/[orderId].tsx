import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/ui/BackButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { formatStoreMoney } from '@/lib/store/money';
import * as commerce from '@/services/store.commerce';
import type { StoreOrder, StoreOrderStatus } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const TIMELINE: StoreOrderStatus[] = [
  'awaiting_payment',
  'paid',
  'processing',
  'ready_for_pickup',
  'shipped',
  'delivered',
];

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').toUpperCase();
}

export default function StoreOrderDetailScreen() {
  const { orderId, created } = useLocalSearchParams<{ orderId: string; created?: string }>();
  const { profile } = useAuth();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      setError(null);
      setOrder(await commerce.getOrder(orderId, profile?.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId, profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const steps = useMemo(() => {
    if (!order) return [];
    const pickup = order.fulfillment_method === 'pickup';
    return TIMELINE.filter((s) => {
      if (pickup && s === 'shipped') return false;
      if (!pickup && s === 'ready_for_pickup') return false;
      return true;
    });
  }, [order]);

  if (loading) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={40} width="50%" style={{ marginTop: spacing.md }} />
        <Skeleton height={160} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error || !order) {
    return (
      <Screen>
        <BackButton />
        <ErrorState message={error ?? 'Order not found'} onRetry={load} />
      </Screen>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';
  const paid = order.payment_status === 'paid';

  return (
    <Screen>
      <BackButton />
      {created === '1' ? (
        <>
          <Text style={styles.kicker}>{paid ? 'ORDER CREATED' : 'ORDER CREATED'}</Text>
          <Text style={styles.hero}>THANK YOU, {firstName.toUpperCase()}.</Text>
          <Text style={styles.note}>
            {paid
              ? 'Payment confirmed. We are preparing your order.'
              : 'Your order was created. Payment confirmation is pending.'}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.kicker}>ORDER</Text>
          <Text style={styles.hero}>{order.order_number}</Text>
        </>
      )}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>ORDER</Text>
        <Text style={styles.cardValue}>{order.order_number}</Text>
        <Text style={styles.cardLabel}>TOTAL</Text>
        <Text style={styles.cardValue}>{formatStoreMoney(order.total_cents, order.currency)}</Text>
        <Text style={styles.cardLabel}>
          {order.fulfillment_method === 'pickup' ? 'PICKUP' : 'DELIVERY'}
        </Text>
        <Text style={styles.cardValue}>
          {order.fulfillment_method === 'pickup'
            ? order.pickup_location
            : [order.shipping_line1, order.shipping_city].filter(Boolean).join(', ')}
        </Text>
        <Text style={styles.cardLabel}>STATUS</Text>
        <Text style={[styles.cardValue, { color: colors.accent }]}>
          {statusLabel(order.status)} · {statusLabel(order.payment_status)}
        </Text>
      </View>

      <SectionHeader title="ITEMS" />
      {(order.items ?? []).map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.itemName}>{item.product_name}</Text>
          <Text style={styles.itemMeta}>
            {[item.color_label, item.size_label].filter(Boolean).join(' / ')} · Qty {item.quantity}
          </Text>
          <Text style={styles.itemPrice}>{formatStoreMoney(item.line_total_cents)}</Text>
        </View>
      ))}

      <SectionHeader title="ORDER TIMELINE" />
      <View style={styles.timeline}>
        {steps.map((step) => {
          const done =
            steps.indexOf(step) <=
            Math.max(
              0,
              steps.findIndex((s) => s === order.status),
            );
          const reached =
            (order.events ?? []).some((e) => e.status === step) || order.status === step || done;
          return (
            <View key={step} style={styles.step}>
              <Text style={[styles.stepMark, reached && { color: colors.accent }]}>
                {reached ? '✓' : '○'}
              </Text>
              <Text style={[styles.stepText, reached && { color: colors.text }]}>
                {statusLabel(step)}
              </Text>
            </View>
          );
        })}
      </View>

      <PrimaryButton title="BACK TO STORE" onPress={() => router.push('/(member)/store')} />
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    marginTop: spacing.md,
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  hero: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.text,
  },
  note: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surface,
    gap: 4,
    marginBottom: spacing.xl,
  },
  cardLabel: {
    marginTop: spacing.sm,
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  cardValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  item: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  itemName: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.text },
  itemMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  itemPrice: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.text },
  timeline: { gap: spacing.sm, marginBottom: spacing.xl },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepMark: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.textMuted, width: 20 },
  stepText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
});
