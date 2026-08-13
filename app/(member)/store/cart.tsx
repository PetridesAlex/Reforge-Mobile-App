import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { MediaImage } from '@/components/ui/MediaImage';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { useStoreCart } from '@/hooks/useStoreCart';
import { formatStoreMoney } from '@/lib/store/money';
import { trackStoreEvent } from '@/lib/store/analytics';
import * as store from '@/services/store';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function StoreCartScreen() {
  const { lines, subtotalCents, issues, setQuantity, removeItem, validate } = useStoreCart();
  const [validating, setValidating] = useState(false);
  const [deliveryCents, setDeliveryCents] = useState(500);

  const onCheckout = async () => {
    setValidating(true);
    try {
      const fulfillment = await store.getFulfillmentSettings();
      setDeliveryCents(fulfillment.standard_delivery_cents);
      const nextIssues = await validate();
      if (nextIssues.some((i) => i.code === 'unavailable' || i.code === 'stock')) {
        return;
      }
      trackStoreEvent('checkout_started', { lines: lines.length });
      router.push('/(member)/store/checkout');
    } finally {
      setValidating(false);
    }
  };

  return (
    <Screen>
      <BackButton />
      <Text style={styles.kicker}>REFORGE</Text>
      <Text style={styles.title}>YOUR BAG</Text>

      {issues.length > 0 ? (
        <View style={styles.issueBox}>
          <Text style={styles.issueTitle}>YOUR CART HAS BEEN UPDATED</Text>
          {issues.map((issue, i) => (
            <Text key={`${issue.variant_id}-${i}`} style={styles.issueText}>
              {issue.message}
            </Text>
          ))}
        </View>
      ) : null}

      {lines.length === 0 ? (
        <EmptyState
          icon="bag-outline"
          title="YOUR BAG IS EMPTY"
          description="Explore the latest REFORGE collection."
          actionLabel="SHOP NOW"
          onAction={() => router.replace('/(member)/store')}
        />
      ) : (
        <>
          <View style={styles.list}>
            {lines.map((line) => (
              <View key={line.variant_id} style={styles.row}>
                <MediaImage uri={line.image_url} style={styles.thumb} rounded={radius.sm} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.name}>{line.product_name}</Text>
                  <Text style={styles.meta}>
                    {[line.color_label, line.size_label ? `Size ${line.size_label}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.price}>
                    {formatStoreMoney(line.unit_price_cents * line.quantity)}
                  </Text>
                  <View style={styles.qtyRow}>
                    <Pressable
                      onPress={() => {
                        void Haptics.selectionAsync();
                        void setQuantity(line.variant_id, line.quantity - 1);
                      }}
                      style={styles.qtyBtn}>
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Text style={styles.qty}>{line.quantity}</Text>
                    <Pressable
                      onPress={() => {
                        void Haptics.selectionAsync();
                        void setQuantity(line.variant_id, line.quantity + 1);
                      }}
                      style={styles.qtyBtn}>
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                    <Pressable onPress={() => void removeItem(line.variant_id)} style={styles.remove}>
                      <Text style={styles.removeText}>REMOVE</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatStoreMoney(subtotalCents)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery from</Text>
              <Text style={styles.summaryValue}>{formatStoreMoney(deliveryCents)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>
                {formatStoreMoney(subtotalCents + deliveryCents)}
              </Text>
            </View>
          </View>

          <PrimaryButton
            title={validating ? 'CHECKING…' : 'PROCEED TO CHECKOUT'}
            onPress={() => void onCheckout()}
            disabled={validating}
          />
          <Pressable onPress={() => router.push('/(member)/store')} style={styles.continue}>
            <Text style={styles.continueText}>CONTINUE SHOPPING</Text>
          </Pressable>
        </>
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
    fontSize: 44,
    lineHeight: 46,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  issueBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.4)',
    backgroundColor: 'rgba(250,204,21,0.08)',
    marginBottom: spacing.md,
    gap: 4,
  },
  issueTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1,
    color: '#FACC15',
  },
  issueText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  list: { gap: spacing.sm, marginBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 88, height: 110 },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  price: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
    minWidth: 16,
    textAlign: 'center',
  },
  remove: { marginLeft: 'auto' },
  removeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.danger,
  },
  summary: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
  },
  totalRow: { marginTop: spacing.xs },
  totalLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.text,
  },
  totalValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.accent,
  },
  continue: { alignItems: 'center', padding: spacing.lg },
  continueText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
});
