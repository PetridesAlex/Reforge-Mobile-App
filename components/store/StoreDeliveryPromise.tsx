import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatStoreMoney } from '@/lib/store/money';
import { colors, fonts, spacing } from '@/constants/theme';

type Props = {
  pickupLocation?: string;
  deliveryCents?: number;
  currency?: string;
};

type PromiseRow = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string;
};

export function StoreDeliveryPromise({
  pickupLocation = 'REFORGE Limassol',
  deliveryCents = 500,
  currency = 'EUR',
}: Props) {
  const deliveryLabel =
    deliveryCents <= 0 ? 'FREE' : formatStoreMoney(deliveryCents, currency);

  const rows: PromiseRow[] = [
    {
      icon: 'flash-outline',
      title: 'QUICK CYPRUS DELIVERY',
      meta: '1–3 working days across Cyprus',
    },
    {
      icon: 'storefront-outline',
      title: 'STUDIO PICKUP',
      meta: `Free · ${pickupLocation}`,
    },
    {
      icon: 'bicycle-outline',
      title: 'LIMASSOL EXPRESS',
      meta: `Local drop from ${deliveryLabel}`,
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.liveDot} />
        <Text style={styles.kicker}>SHIPPING · CYPRUS</Text>
      </View>
      <Text style={styles.headline}>TRAIN HERE. WEAR HERE.</Text>
      <Text style={styles.sub}>
        Local fulfilment from REFORGE — fast island delivery and free studio pickup.
      </Text>

      <View style={styles.list}>
        {rows.map((row, index) => (
          <View
            key={row.title}
            style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
            <View style={styles.iconWell}>
              <Ionicons name={row.icon} size={16} color={colors.accent} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowMeta}>{row.meta}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    borderRadius: 4,
    backgroundColor: 'rgba(20,20,20,0.92)',
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 1,
    color: colors.text,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(245,245,245,0.72)',
    marginBottom: 4,
  },
  list: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text,
  },
  rowMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
