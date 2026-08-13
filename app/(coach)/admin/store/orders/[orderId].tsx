import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppInput } from '@/components/ui/AppInput';
import { BackButton } from '@/components/ui/BackButton';
import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { StoreBadge } from '@/components/store/StoreBadge';
import { formatStoreMoney } from '@/lib/store/money';
import * as commerce from '@/services/store.commerce';
import * as store from '@/services/store';
import type { StoreOrder, StoreOrderStatus } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

const STATUS_FLOW: StoreOrderStatus[] = [
  'awaiting_payment',
  'paid',
  'processing',
  'ready_for_pickup',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

const STATUS_LABEL: Record<StoreOrderStatus, string> = {
  awaiting_payment: 'AWAITING PAYMENT',
  paid: 'CONFIRMED',
  processing: 'PROCESSING',
  ready_for_pickup: 'READY FOR PICKUP',
  shipped: 'SHIPPED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
  refunded: 'REFUNDED',
};

function statusTone(status: string): 'accent' | 'warn' | 'danger' | 'solid' | 'muted' {
  if (status === 'delivered' || status === 'paid') return 'accent';
  if (status === 'cancelled' || status === 'refunded' || status === 'failed') return 'danger';
  if (status === 'awaiting_payment' || status === 'unpaid') return 'warn';
  if (status === 'ready_for_pickup' || status === 'shipped' || status === 'processing') return 'solid';
  return 'muted';
}

function formatLabel(status: string) {
  return status.replace(/_/g, ' ').toUpperCase();
}

function prettyNameFromEmail(email: string) {
  const local = email.split('@')[0] ?? '';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.detailMono]} selectable>
        {value}
      </Text>
    </View>
  );
}

function Section({
  kicker,
  title,
  children,
  trailing,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionKicker}>{kicker}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {trailing}
      </View>
      <View style={styles.sectionRule} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function AdminStoreOrderDetail() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [thumbByProduct, setThumbByProduct] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      setError(null);
      const row = await commerce.getOrder(orderId);
      setOrder(row);
      setInternalNotes(row?.internal_notes ?? '');

      const productIds = Array.from(
        new Set((row?.items ?? []).map((i) => i.product_id).filter(Boolean) as string[]),
      );
      if (productIds.length) {
        const entries = await Promise.all(
          productIds.map(async (id) => {
            try {
              const p = await store.getProduct(id);
              return [id, p?.primary_image_url ?? ''] as const;
            } catch {
              return [id, ''] as const;
            }
          }),
        );
        setThumbByProduct(Object.fromEntries(entries.filter(([, url]) => Boolean(url))));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const customer = useMemo(() => {
    if (!order) {
      return { name: '', email: '', phone: '', isEmailAsName: false };
    }
    const shippingName = [order.shipping_first_name, order.shipping_last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const rawName = (order.customer_name ?? shippingName).trim();
    const email = order.contact_email.trim();
    const isEmailAsName = Boolean(rawName) && rawName.toLowerCase() === email.toLowerCase();
    const name =
      rawName && !isEmailAsName
        ? rawName
        : prettyNameFromEmail(email) || 'Member';
    return {
      name,
      email,
      phone: order.contact_phone?.trim() || '',
      isEmailAsName,
    };
  }, [order]);

  const setStatus = async (status: StoreOrderStatus) => {
    if (!order) return;
    setSaving(true);
    try {
      await commerce.updateOrderStatus(order.id, status, note.trim() || undefined);
      setNote('');
      await load();
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async () => {
    if (!order) return;
    setSaving(true);
    try {
      await commerce.markOrderPaid(order.id, 'mock');
      await load();
    } catch (e) {
      Alert.alert('Payment update failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!order) return;
    setSaving(true);
    try {
      await commerce.updateOrderInternalNotes(order.id, internalNotes);
      await load();
    } catch (e) {
      Alert.alert('Could not save notes', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={40} width="50%" style={{ marginTop: spacing.md }} />
        <Skeleton height={120} style={{ marginTop: spacing.lg }} />
        <Skeleton height={180} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error || !order) {
    return (
      <Screen>
        <BackButton />
        <ErrorState message={error ?? 'Not found'} onRetry={load} />
      </Screen>
    );
  }

  const pickup = order.fulfillment_method === 'pickup';
  const itemCount = (order.items ?? []).reduce((s, i) => s + i.quantity, 0);
  const availableStatuses = STATUS_FLOW.filter((s) => {
    if (pickup && s === 'shipped') return false;
    if (!pickup && s === 'ready_for_pickup') return false;
    return true;
  });

  return (
    <Screen>
      <BackButton />

      <LinearGradient
        colors={['rgba(200,255,0,0.1)', 'rgba(10,10,10,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <Text style={styles.kicker}>REFORGE · ORDER</Text>
        <Text style={styles.title}>{order.order_number}</Text>
        <View style={styles.badgeRow}>
          <StoreBadge
            label={STATUS_LABEL[order.status] ?? formatLabel(order.status)}
            tone={statusTone(order.status)}
          />
          <StoreBadge
            label={`PAYMENT ${formatLabel(order.payment_status)}`}
            tone={statusTone(order.payment_status)}
          />
          <StoreBadge label={pickup ? 'PICKUP' : 'DELIVERY'} tone="muted" />
        </View>
        <View style={styles.snapshot}>
          <View style={styles.snapshotCell}>
            <Text style={styles.snapshotLabel}>TOTAL</Text>
            <Text style={styles.snapshotValue}>{formatStoreMoney(order.total_cents)}</Text>
          </View>
          <View style={styles.snapshotDivider} />
          <View style={styles.snapshotCell}>
            <Text style={styles.snapshotLabel}>ITEMS</Text>
            <Text style={styles.snapshotValue}>{itemCount}</Text>
          </View>
          <View style={styles.snapshotDivider} />
          <View style={styles.snapshotCell}>
            <Text style={styles.snapshotLabel}>PLACED</Text>
            <Text style={styles.snapshotValueSm}>
              {new Date(order.created_at).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <Section kicker="01" title="CUSTOMER">
        <Text style={styles.customerName}>{customer.name}</Text>
        <DetailRow label="Email" value={customer.email} />
        {customer.phone ? <DetailRow label="Phone" value={customer.phone} /> : null}
        <DetailRow label="Member ID" value={order.user_id} mono />
      </Section>

      <Section
        kicker="02"
        title="FULFILLMENT"
        trailing={
          <View style={styles.methodPill}>
            <Ionicons
              name={pickup ? 'storefront-outline' : 'bicycle-outline'}
              size={14}
              color={colors.accent}
            />
            <Text style={styles.methodPillText}>{pickup ? 'PICKUP' : 'DELIVERY'}</Text>
          </View>
        }>
        {pickup ? (
          <>
            <DetailRow label="Method" value="Studio pickup" />
            <DetailRow label="Location" value={order.pickup_location ?? 'REFORGE Limassol'} />
          </>
        ) : (
          <>
            <DetailRow label="Method" value="Cyprus delivery" />
            <DetailRow
              label="Recipient"
              value={
                [order.shipping_first_name, order.shipping_last_name].filter(Boolean).join(' ') ||
                customer.name
              }
            />
            <DetailRow
              label="Address"
              value={[order.shipping_line1, order.shipping_line2].filter(Boolean).join(', ')}
            />
            <DetailRow
              label="City"
              value={[order.shipping_postal_code, order.shipping_city].filter(Boolean).join(' ')}
            />
            <DetailRow label="Country" value={order.shipping_country ?? 'CY'} />
          </>
        )}
      </Section>

      <Section kicker="03" title="PRODUCTS" trailing={<Text style={styles.countHint}>{itemCount} units</Text>}>
        {(order.items ?? []).map((item, index) => {
          const thumb = item.product_id ? thumbByProduct[item.product_id] : undefined;
          return (
            <View
              key={item.id}
              style={[styles.productCard, index > 0 && styles.productCardSpaced]}>
              <View style={styles.productTop}>
                <View style={styles.thumbWrap}>
                  {thumb ? (
                    <MediaImage uri={thumb} style={styles.thumb} rounded={3} />
                  ) : (
                    <View style={styles.thumbFallback}>
                      <Ionicons name="shirt-outline" size={22} color={colors.textMuted} />
                    </View>
                  )}
                </View>
                <View style={styles.productMain}>
                  <Text style={styles.productName}>{item.product_name}</Text>
                  <Text style={styles.productLineTotal}>
                    {formatStoreMoney(item.line_total_cents)}
                  </Text>
                </View>
              </View>
              <View style={styles.specGrid}>
                <View style={styles.specCell}>
                  <Text style={styles.specLabel}>COLOR</Text>
                  <Text style={styles.specValue}>{item.color_label ?? '—'}</Text>
                </View>
                <View style={styles.specCell}>
                  <Text style={styles.specLabel}>SIZE</Text>
                  <Text style={styles.specValue}>{item.size_label ?? '—'}</Text>
                </View>
                <View style={styles.specCell}>
                  <Text style={styles.specLabel}>QTY</Text>
                  <Text style={styles.specValueAccent}>×{item.quantity}</Text>
                </View>
                <View style={styles.specCell}>
                  <Text style={styles.specLabel}>UNIT</Text>
                  <Text style={styles.specValue}>{formatStoreMoney(item.unit_price_cents)}</Text>
                </View>
              </View>
              <Text style={styles.skuLine} selectable>
                SKU · {item.sku ?? 'n/a'}
              </Text>
            </View>
          );
        })}
      </Section>

      <Section kicker="04" title="PAYMENT">
        <View style={styles.moneyRow}>
          <Text style={styles.moneyLabel}>Subtotal</Text>
          <Text style={styles.moneyValue}>{formatStoreMoney(order.subtotal_cents)}</Text>
        </View>
        <View style={styles.moneyRow}>
          <Text style={styles.moneyLabel}>{pickup ? 'Pickup fee' : 'Delivery'}</Text>
          <Text style={styles.moneyValue}>
            {order.delivery_cents === 0 ? 'FREE' : formatStoreMoney(order.delivery_cents)}
          </Text>
        </View>
        {order.discount_cents > 0 ? (
          <View style={styles.moneyRow}>
            <Text style={styles.moneyLabel}>
              Discount{order.discount_code ? ` · ${order.discount_code}` : ''}
            </Text>
            <Text style={[styles.moneyValue, { color: colors.accent }]}>
              −{formatStoreMoney(order.discount_cents)}
            </Text>
          </View>
        ) : null}
        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>ORDER TOTAL</Text>
          <Text style={styles.totalValue}>{formatStoreMoney(order.total_cents)}</Text>
        </View>
        <DetailRow label="Provider" value={order.payment_provider.toUpperCase()} />
        <DetailRow label="Status" value={formatLabel(order.payment_status)} />
        {order.paid_at ? (
          <DetailRow label="Paid at" value={new Date(order.paid_at).toLocaleString()} />
        ) : null}
        {order.payment_status !== 'paid' ? (
          <Pressable
            disabled={saving}
            onPress={() => void markPaid()}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.background} />
            <Text style={styles.primaryBtnText}>MARK AS PAID</Text>
          </Pressable>
        ) : null}
      </Section>

      <Section kicker="05" title="STATUS CONTROL">
        <Text style={styles.help}>
          Move the order through fulfillment. Optional note is saved on the timeline.
        </Text>
        <AppInput
          label="Status note"
          value={note}
          onChangeText={setNote}
          placeholder="Packed / customer notified / left studio…"
        />
        <View style={styles.actions}>
          {availableStatuses.map((status) => {
            const active = order.status === status;
            return (
              <Pressable
                key={status}
                disabled={saving || active}
                onPress={() => void setStatus(status)}
                style={[styles.actionChip, active && styles.actionChipActive]}>
                <Text style={[styles.actionText, active && styles.actionTextActive]}>
                  {STATUS_LABEL[status]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section kicker="06" title="INTERNAL NOTES">
        <AppInput
          label="Staff only"
          value={internalNotes}
          onChangeText={setInternalNotes}
          multiline
          placeholder="Visible only to REFORGE admins"
        />
        <Pressable
          disabled={saving}
          onPress={() => void saveNotes()}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.secondaryBtnText}>SAVE NOTES</Text>
        </Pressable>
      </Section>

      <Section kicker="07" title="TIMELINE">
        {(order.events ?? []).length === 0 ? (
          <Text style={styles.help}>No events yet.</Text>
        ) : (
          (order.events ?? [])
            .slice()
            .reverse()
            .map((ev, idx) => (
              <View key={ev.id} style={styles.eventRow}>
                <View style={styles.eventRail}>
                  <View style={[styles.eventDot, idx === 0 && styles.eventDotActive]} />
                  {idx < (order.events?.length ?? 0) - 1 ? <View style={styles.eventLine} /> : null}
                </View>
                <View style={styles.eventBody}>
                  <Text style={styles.eventStatus}>{formatLabel(ev.status)}</Text>
                  <Text style={styles.eventMeta}>
                    {new Date(ev.created_at).toLocaleString()}
                  </Text>
                  {ev.note ? <Text style={styles.eventNote}>{ev.note}</Text> : null}
                </View>
              </View>
            ))
        )}
      </Section>

      <Pressable onPress={() => void load()} style={styles.refresh}>
        <Ionicons name="refresh-outline" size={14} color={colors.textMuted} />
        <Text style={styles.refreshText}>REFRESH ORDER</Text>
      </Pressable>
      <View style={{ height: spacing.xxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: 'rgba(16,16,16,0.95)',
    gap: 10,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    color: colors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  snapshot: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  snapshotCell: {
    flex: 1,
    gap: 4,
  },
  snapshotDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 10,
  },
  snapshotLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  snapshotValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
  },
  snapshotValueSm: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
  },
  section: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sectionKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  sectionTitle: {
    marginTop: 2,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
  },
  sectionRule: {
    height: 2,
    width: 36,
    backgroundColor: colors.accent,
    marginTop: 10,
    marginBottom: 14,
    opacity: 0.85,
  },
  sectionBody: {
    gap: 10,
  },
  countHint: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
    marginTop: 8,
  },
  customerName: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
    marginBottom: 4,
  },
  detailRow: {
    gap: 2,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  detailLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  detailValue: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  detailMono: {
    fontSize: 12,
    color: colors.textMuted,
  },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  methodPillText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  productCard: {
    padding: spacing.md,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    gap: 12,
  },
  productCardSpaced: {
    marginTop: 4,
  },
  productTop: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 4,
  },
  productName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  productLineTotal: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.accent,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specCell: {
    width: '47%',
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 3,
  },
  specLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  specValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  specValueAccent: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.accent,
  },
  skuLine: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  moneyLabel: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  moneyValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  totalBar: {
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.text,
  },
  totalValue: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 32,
    color: colors.accent,
  },
  help: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionChip: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  actionChipActive: {
    borderColor: 'rgba(200,255,0,0.55)',
    backgroundColor: 'rgba(200,255,0,0.14)',
  },
  actionText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.textMuted,
  },
  actionTextActive: { color: colors.accent },
  primaryBtn: {
    marginTop: 6,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  primaryBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.background,
  },
  secondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  secondaryBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
  },
  eventRail: {
    width: 12,
    alignItems: 'center',
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  eventDotActive: {
    backgroundColor: colors.accent,
  },
  eventLine: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 4,
  },
  eventBody: {
    flex: 1,
    paddingBottom: 14,
    gap: 2,
  },
  eventStatus: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text,
  },
  eventMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  eventNote: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  refreshText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textMuted,
  },
});
