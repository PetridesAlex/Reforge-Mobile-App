import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AppInput } from '@/components/ui/AppInput';
import { BackButton } from '@/components/ui/BackButton';
import { GraffitiWordmark } from '@/components/ui/GraffitiWordmark';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useStoreCart } from '@/hooks/useStoreCart';
import { trackStoreEvent } from '@/lib/store/analytics';
import { getActiveStorePaymentProvider } from '@/lib/store/payments';
import { formatStoreMoney } from '@/lib/store/money';
import * as commerce from '@/services/store.commerce';
import * as store from '@/services/store';
import type { StoreFulfillmentMethod } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

function CheckoutSection({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionKicker}>{kicker}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionRule} />
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function StoreCheckoutScreen() {
  const { width } = useWindowDimensions();
  const narrow = width < 420;
  const { profile } = useAuth();
  const { lines, subtotalCents, clear, validate } = useStoreCart();
  const [method, setMethod] = useState<StoreFulfillmentMethod>('pickup');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState(profile?.full_name?.split(' ')[0] ?? '');
  const [lastName, setLastName] = useState(profile?.full_name?.split(' ').slice(1).join(' ') ?? '');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('Limassol');
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('CY');
  const [discountCode, setDiscountCode] = useState('');
  const [discountCents, setDiscountCents] = useState(0);
  const [deliveryCents, setDeliveryCents] = useState(0);
  const [standardDeliveryCents, setStandardDeliveryCents] = useState(500);
  const [pickupLabel, setPickupLabel] = useState('PICK UP FROM REFORGE');
  const [pickupLocation, setPickupLocation] = useState('REFORGE Limassol');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void store.getFulfillmentSettings().then((f) => {
      setStandardDeliveryCents(f.standard_delivery_cents);
      setDeliveryCents(method === 'delivery' ? f.standard_delivery_cents : 0);
      setPickupLabel(f.pickup_label);
      setPickupLocation(f.pickup_location);
    });
  }, [method]);

  useEffect(() => {
    if (!lines.length) router.replace('/(member)/store/cart');
  }, [lines.length]);

  const total = useMemo(
    () => Math.max(0, subtotalCents + deliveryCents - discountCents),
    [subtotalCents, deliveryCents, discountCents],
  );

  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  const applyDiscount = async () => {
    setError(null);
    const preview = await commerce.previewDiscount(
      discountCode,
      subtotalCents,
      method === 'delivery' ? standardDeliveryCents : 0,
    );
    if (!preview.ok) {
      setDiscountCents(0);
      setError(preview.message);
      return;
    }
    setDiscountCents(preview.discount_cents);
    setDeliveryCents(preview.delivery_cents);
    void Haptics.selectionAsync();
  };

  const placeOrder = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await validate();
      const provider = getActiveStorePaymentProvider();
      const order = await commerce.createOrder({
        userId: profile.id,
        lines,
        fulfillment_method: method,
        contact_email: email.trim(),
        contact_phone: phone.trim() || undefined,
        shipping_first_name:
          firstName.trim() || profile.full_name?.split(' ')[0] || undefined,
        shipping_last_name:
          lastName.trim() ||
          profile.full_name?.split(' ').slice(1).join(' ') ||
          undefined,
        shipping_line1: method === 'delivery' ? line1.trim() : undefined,
        shipping_line2: method === 'delivery' ? line2.trim() || undefined : undefined,
        shipping_city: method === 'delivery' ? city.trim() : undefined,
        shipping_postal_code: method === 'delivery' ? postal.trim() : undefined,
        shipping_country: method === 'delivery' ? country.trim() : undefined,
        discount_code: discountCode.trim() || undefined,
        payment_provider: provider.id,
      });

      const session = await provider.createCheckoutSession({
        orderId: order.id,
        amountCents: order.total_cents,
        currency: order.currency,
      });

      if (provider.id === 'mock' || session.mockComplete) {
        await commerce.markOrderPaid(order.id, 'mock');
      } else if (session.checkoutUrl) {
        // Stripe Checkout URL — open externally in live mode
      }

      await clear();
      trackStoreEvent('checkout_completed', { order_id: order.id, total: order.total_cents });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/(member)/store/orders/${order.id}?created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create order');
    } finally {
      setSaving(false);
    }
  };

  const paymentProvider = getActiveStorePaymentProvider();

  return (
    <Screen>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.topMeta}>
          {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
        </Text>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.kicker}>SECURE CHECKOUT</Text>
        <GraffitiWordmark text="ORDER" size={52} delay={40} />
        <Text style={styles.titleSub}>Cyprus fulfilment · REFORGE Limassol</Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <CheckoutSection kicker="01" title="CONTACT">
        <View style={styles.fieldStack}>
          <AppInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <AppInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+357..."
          />
        </View>
      </CheckoutSection>

      <CheckoutSection kicker="02" title="DELIVERY METHOD">
        <View style={styles.methods}>
          <Pressable
            onPress={() => setMethod('pickup')}
            style={({ pressed }) => [
              styles.method,
              method === 'pickup' && styles.methodActive,
              pressed && styles.methodPressed,
            ]}>
            <View style={[styles.methodRadio, method === 'pickup' && styles.methodRadioActive]}>
              {method === 'pickup' ? <View style={styles.methodRadioDot} /> : null}
            </View>
            <View style={styles.methodIcon}>
              <Ionicons
                name="storefront-outline"
                size={18}
                color={method === 'pickup' ? colors.accent : colors.textMuted}
              />
            </View>
            <View style={styles.methodCopy}>
              <Text style={[styles.methodText, method === 'pickup' && styles.methodTextActive]}>
                {pickupLabel}
              </Text>
              <Text style={styles.methodMeta}>{pickupLocation} · Free</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setMethod('delivery')}
            style={({ pressed }) => [
              styles.method,
              method === 'delivery' && styles.methodActive,
              pressed && styles.methodPressed,
            ]}>
            <View style={[styles.methodRadio, method === 'delivery' && styles.methodRadioActive]}>
              {method === 'delivery' ? <View style={styles.methodRadioDot} /> : null}
            </View>
            <View style={styles.methodIcon}>
              <Ionicons
                name="bicycle-outline"
                size={18}
                color={method === 'delivery' ? colors.accent : colors.textMuted}
              />
            </View>
            <View style={styles.methodCopy}>
              <Text style={[styles.methodText, method === 'delivery' && styles.methodTextActive]}>
                CYPRUS DELIVERY
              </Text>
              <Text style={styles.methodMeta}>
                1–3 days · From {formatStoreMoney(standardDeliveryCents)}
              </Text>
            </View>
          </Pressable>
        </View>
      </CheckoutSection>

      {method === 'delivery' ? (
        <CheckoutSection kicker="02B" title="DELIVERY ADDRESS">
          <View style={styles.fieldStack}>
            <View style={[styles.row2, narrow && styles.rowStack]}>
              <View style={styles.flex}>
                <AppInput label="First name" value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={styles.flex}>
                <AppInput label="Last name" value={lastName} onChangeText={setLastName} />
              </View>
            </View>
            <AppInput label="Address" value={line1} onChangeText={setLine1} />
            <AppInput label="Apartment / suite" value={line2} onChangeText={setLine2} />
            <View style={[styles.row2, narrow && styles.rowStack]}>
              <View style={styles.flex}>
                <AppInput label="City" value={city} onChangeText={setCity} />
              </View>
              <View style={styles.flex}>
                <AppInput label="Postal code" value={postal} onChangeText={setPostal} />
              </View>
            </View>
            <AppInput label="Country" value={country} onChangeText={setCountry} />
          </View>
        </CheckoutSection>
      ) : null}

      <CheckoutSection kicker="03" title="DISCOUNT">
        <View style={[styles.discountRow, narrow && styles.rowStack]}>
          <View style={styles.flex}>
            <AppInput
              label="Code"
              value={discountCode}
              onChangeText={setDiscountCode}
              autoCapitalize="characters"
              placeholder="REFORGE10"
            />
          </View>
          <Pressable
            onPress={() => void applyDiscount()}
            style={({ pressed }) => [styles.applyBtn, pressed && styles.applyBtnPressed]}>
            <Text style={styles.applyText}>APPLY</Text>
          </Pressable>
        </View>
      </CheckoutSection>

      <CheckoutSection kicker="04" title="ORDER SUMMARY">
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatStoreMoney(subtotalCents)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {method === 'pickup' ? 'Pickup' : 'Delivery'}
            </Text>
            <Text style={styles.summaryValue}>
              {deliveryCents === 0 ? 'FREE' : formatStoreMoney(deliveryCents)}
            </Text>
          </View>
          {discountCents > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, styles.discountValue]}>
                −{formatStoreMoney(discountCents)}
              </Text>
            </View>
          ) : null}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{formatStoreMoney(total)}</Text>
          </View>
        </View>
      </CheckoutSection>

      <CheckoutSection kicker="05" title="PAYMENT">
        <View style={styles.paymentBox}>
          <View style={styles.paymentHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
            <Text style={styles.paymentTitle}>
              {paymentProvider.id === 'stripe' ? 'STRIPE CHECKOUT' : 'SECURE CHECKOUT'}
            </Text>
          </View>
          <Text style={styles.paymentBody}>
            {paymentProvider.id === 'stripe'
              ? 'You will be redirected to Stripe. Card details are never collected in the REFORGE app.'
              : 'Card details are never entered in-app. This places your order through REFORGE secure checkout.'}
          </Text>
        </View>
      </CheckoutSection>

      <Pressable
        onPress={() => void placeOrder()}
        disabled={saving || !email.trim()}
        style={({ pressed }) => [
          styles.cta,
          (saving || !email.trim()) && styles.ctaDisabled,
          pressed && !(saving || !email.trim()) && styles.ctaPressed,
        ]}>
        <Text style={styles.ctaText}>{saving ? 'PLACING ORDER…' : 'PLACE ORDER'}</Text>
        <Text style={styles.ctaPrice}>{formatStoreMoney(total)}</Text>
      </Pressable>

      <Text style={styles.footerNote}>REFORGE · LIMASSOL · CYPRUS</Text>
      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: spacing.md,
  },
  topMeta: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: 'rgba(163,163,163,0.9)',
  },
  titleBlock: {
    marginBottom: spacing.lg,
    gap: 6,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.8,
    color: colors.accent,
  },
  titleSub: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.35)',
    backgroundColor: 'rgba(255,77,77,0.1)',
    borderRadius: 4,
  },
  error: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.danger,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
    gap: 4,
  },
  sectionKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 1,
    color: colors.text,
  },
  sectionRule: {
    width: 36,
    height: 2,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  sectionBody: {
    gap: spacing.md,
  },
  fieldStack: {
    gap: spacing.md,
  },
  methods: {
    gap: spacing.sm,
  },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(20,20,20,0.92)',
  },
  methodActive: {
    borderColor: 'rgba(200,255,0,0.55)',
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  methodPressed: {
    opacity: 0.92,
  },
  methodRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodRadioActive: {
    borderColor: colors.accent,
  },
  methodRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  methodIcon: {
    width: 34,
    height: 34,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  methodCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  methodText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },
  methodTextActive: {
    color: colors.accent,
  },
  methodMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  row2: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowStack: {
    flexDirection: 'column',
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  applyBtn: {
    minHeight: 52,
    minWidth: 96,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginBottom: 0,
  },
  applyBtnPressed: {
    opacity: 0.9,
  },
  applyText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.background,
  },
  summaryCard: {
    padding: spacing.lg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: 'rgba(20,20,20,0.92)',
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  discountValue: {
    color: colors.accent,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 2,
  },
  totalLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    letterSpacing: 1.6,
    color: colors.text,
  },
  totalValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.accent,
  },
  paymentBox: {
    padding: spacing.lg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(20,20,20,0.92)',
    gap: spacing.sm,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  paymentBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  cta: {
    marginTop: spacing.sm,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    borderRadius: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  ctaPressed: { opacity: 0.9 },
  ctaDisabled: { opacity: 0.45 },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    letterSpacing: 1.8,
    color: colors.background,
  },
  ctaPrice: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.background,
  },
  footerNote: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: 'rgba(163,163,163,0.7)',
  },
});
