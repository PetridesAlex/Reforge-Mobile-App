import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { StoreBadge } from '@/components/store/StoreBadge';
import { formatStoreMoney } from '@/lib/store/money';
import * as commerce from '@/services/store.commerce';
import * as store from '@/services/store';
import type { StoreDashboardStats, StoreOrder, StoreProduct } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

type NavItem = {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  primary?: boolean;
};

const NAV: NavItem[] = [
  {
    label: 'ORDERS',
    sub: 'Fulfillment',
    icon: 'receipt-outline',
    href: '/(coach)/admin/store/orders',
    primary: true,
  },
  {
    label: 'PRODUCTS',
    sub: 'Catalog',
    icon: 'shirt-outline',
    href: '/(coach)/admin/store/products',
  },
  {
    label: 'INVENTORY',
    sub: 'Stock',
    icon: 'cube-outline',
    href: '/(coach)/admin/store/inventory',
  },
  {
    label: 'NEW PIECE',
    sub: 'Create',
    icon: 'add-outline',
    href: '/(coach)/admin/store/products/new',
  },
];

function statusTone(status: string): 'accent' | 'warn' | 'danger' | 'solid' | 'muted' {
  if (status === 'delivered' || status === 'paid') return 'accent';
  if (status === 'cancelled' || status === 'refunded' || status === 'failed') return 'danger';
  if (status === 'awaiting_payment' || status === 'unpaid') return 'warn';
  return 'solid';
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').toUpperCase();
}

function customerLabel(order: StoreOrder) {
  const shipping = [order.shipping_first_name, order.shipping_last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const raw = (order.customer_name ?? shipping).trim();
  if (raw && raw.toLowerCase() !== order.contact_email.toLowerCase()) return raw;
  const local = order.contact_email.split('@')[0] ?? 'Member';
  return local
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function Section({
  kicker,
  title,
  actionLabel,
  onAction,
  children,
}: {
  kicker: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionKicker}>{kicker}</Text>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8} style={styles.sectionAction}>
            <Text style={styles.sectionActionText}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={12} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.sectionRule} />
      {children}
    </View>
  );
}

export default function AdminStoreDashboard() {
  const [stats, setStats] = useState<StoreDashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<
    Awaited<ReturnType<typeof store.listInventory>>
  >([]);
  const [recent, setRecent] = useState<StoreProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, inv, products, orders] = await Promise.all([
        store.getDashboardStats(),
        store.listInventory({ lowOnly: true }),
        store.listProducts({ status: 'all', sort: 'newest', limit: 6 }),
        commerce.listAdminOrders('all'),
      ]);
      setStats(s);
      setLowStock(inv.slice(0, 8));
      setRecent(products);
      setRecentOrders(orders.slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load store');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <BackButton />
        <Skeleton height={28} width="50%" style={{ marginTop: spacing.md }} />
        <Skeleton height={140} style={{ marginTop: spacing.lg }} />
        <Skeleton height={180} style={{ marginTop: spacing.md }} />
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

      <LinearGradient
        colors={['rgba(200,255,0,0.12)', 'rgba(14,14,14,0.98)', 'rgba(10,10,10,1)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>REFORGE COMMERCE</Text>
            <Text style={styles.title}>STORE</Text>
            <Text style={styles.subtitle}>Orders · catalog · inventory</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(coach)/admin/store/products/new')}
            style={({ pressed }) => [styles.heroCta, pressed && { opacity: 0.9 }]}>
            <Ionicons name="add" size={16} color={colors.background} />
            <Text style={styles.heroCtaText}>ADD</Text>
          </Pressable>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>OPEN</Text>
            <Text style={styles.heroStatValue}>{stats?.openOrders ?? 0}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>REVENUE</Text>
            <Text style={styles.heroStatValueMoney}>
              {formatStoreMoney(stats?.revenueCents ?? 0)}
            </Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>AWAITING</Text>
            <Text style={styles.heroStatValue}>{stats?.awaitingPaymentOrders ?? 0}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.navGrid}>
        {NAV.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.href as never)}
            style={({ pressed }) => [
              styles.navCard,
              item.primary && styles.navCardPrimary,
              pressed && { opacity: 0.88 },
            ]}>
            <View style={[styles.navIcon, item.primary && styles.navIconPrimary]}>
              <Ionicons
                name={item.icon}
                size={18}
                color={item.primary ? colors.background : colors.accent}
              />
            </View>
            <Text style={[styles.navLabel, item.primary && styles.navLabelPrimary]}>
              {item.label}
            </Text>
            <Text style={[styles.navSub, item.primary && styles.navSubPrimary]}>{item.sub}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.metricStrip}>
        {[
          { label: 'PAID', value: String(stats?.paidOrders ?? 0) },
          { label: 'ACTIVE', value: String(stats?.activeProducts ?? 0) },
          { label: 'DRAFT', value: String(stats?.draftProducts ?? 0) },
          { label: 'UNITS', value: String(stats?.totalUnits ?? 0) },
          { label: 'LOW', value: String(stats?.lowStockVariants ?? 0), warn: true },
        ].map((m, i) => (
          <View key={m.label} style={styles.metricItem}>
            {i > 0 ? <View style={styles.metricDivider} /> : null}
            <View style={styles.metricCopy}>
              <Text style={[styles.metricValue, m.warn && styles.metricWarn]}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          </View>
        ))}
      </View>

      <Section
        kicker="01"
        title="RECENT ORDERS"
        actionLabel={recentOrders.length > 0 ? 'VIEW ALL' : undefined}
        onAction={
          recentOrders.length > 0
            ? () => router.push('/(coach)/admin/store/orders')
            : undefined
        }>
        {recentOrders.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No orders yet"
            description="Member checkouts appear here with customer and status."
          />
        ) : (
          <View style={styles.list}>
            {recentOrders.map((order) => {
              const pickup = order.fulfillment_method === 'pickup';
              return (
                <Pressable
                  key={order.id}
                  onPress={() => router.push(`/(coach)/admin/store/orders/${order.id}`)}
                  style={({ pressed }) => [styles.orderCard, pressed && { opacity: 0.92 }]}>
                  <View style={styles.orderTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.orderNumber}>{order.order_number}</Text>
                      <Text style={styles.orderCustomer} numberOfLines={1}>
                        {customerLabel(order)}
                      </Text>
                    </View>
                    <Text style={styles.orderTotal}>{formatStoreMoney(order.total_cents)}</Text>
                  </View>
                  <Text style={styles.orderMeta} numberOfLines={1}>
                    {order.contact_email}
                    {order.contact_phone ? ` · ${order.contact_phone}` : ''}
                  </Text>
                  <View style={styles.orderFooter}>
                    <View style={styles.badgeRow}>
                      <StoreBadge
                        label={formatStatus(order.status)}
                        tone={statusTone(order.status)}
                        size="sm"
                      />
                      <StoreBadge
                        label={`PAY ${formatStatus(order.payment_status)}`}
                        tone={statusTone(order.payment_status)}
                        size="sm"
                      />
                      <StoreBadge label={pickup ? 'PICKUP' : 'DELIVERY'} tone="muted" size="sm" />
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Section>

      <Section
        kicker="02"
        title="LOW STOCK"
        actionLabel="INVENTORY"
        onAction={() => router.push('/(coach)/admin/store/inventory')}>
        {lowStock.length === 0 ? (
          <EmptyState
            icon="checkmark-circle-outline"
            title="Stock looks healthy"
            description="No variants are at or below the low-stock threshold."
          />
        ) : (
          <View style={styles.list}>
            {lowStock.map((row) => (
              <View key={row.id} style={styles.plainRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.plainTitle} numberOfLines={1}>
                    {row.product_name}
                  </Text>
                  <Text style={styles.plainMeta}>
                    {[row.color_label, row.size_label].filter(Boolean).join(' / ') || row.sku}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stock,
                    row.stock_qty <= 0 ? { color: colors.danger } : { color: '#FACC15' },
                  ]}>
                  {row.stock_qty <= 0 ? 'SOLD OUT' : `${row.stock_qty} LEFT`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section
        kicker="03"
        title="CATALOG"
        actionLabel="ALL"
        onAction={() => router.push('/(coach)/admin/store/products')}>
        {recent.length === 0 ? (
          <EmptyState
            icon="bag-outline"
            title="No products yet"
            description="Create your first REFORGE piece to open the store."
            actionLabel="ADD PRODUCT"
            onAction={() => router.push('/(coach)/admin/store/products/new')}
          />
        ) : (
          <View style={styles.list}>
            {recent.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/(coach)/admin/store/products/${p.id}`)}
                style={({ pressed }) => [styles.plainRow, pressed && { opacity: 0.9 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.plainTitle} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.plainMeta}>
                    {p.status.toUpperCase()} · {formatStoreMoney(p.price_cents)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )}
      </Section>

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    overflow: 'hidden',
    gap: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.6,
    color: colors.accent,
  },
  title: {
    marginTop: 2,
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 52,
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 13,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  heroCta: {
    marginTop: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 2,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroCtaText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.background,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 14,
  },
  heroStat: {
    flex: 1,
    gap: 4,
  },
  heroStatDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginHorizontal: 10,
  },
  heroStatLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  heroStatValue: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 32,
    color: colors.text,
  },
  heroStatValueMoney: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.accent,
    marginTop: 2,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  navCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.surface,
    gap: 6,
  },
  navCardPrimary: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
  },
  navIconPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  navLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.text,
  },
  navLabelPrimary: {
    color: colors.accent,
  },
  navSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  navSubPrimary: {
    color: 'rgba(200,255,0,0.7)',
  },
  metricStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: spacing.lg,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(20,20,20,0.9)',
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 6,
  },
  metricCopy: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: colors.text,
  },
  metricWarn: {
    color: '#FACC15',
  },
  metricLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
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
    fontSize: 30,
    lineHeight: 32,
    color: colors.text,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  sectionActionText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  sectionRule: {
    height: 2,
    width: 36,
    backgroundColor: colors.accent,
    marginTop: 10,
    marginBottom: 14,
    opacity: 0.85,
  },
  list: {
    gap: 8,
  },
  orderCard: {
    padding: spacing.md,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.14)',
    backgroundColor: colors.surface,
    gap: 8,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  orderNumber: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
  },
  orderCustomer: {
    marginTop: 2,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  orderTotal: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.accent,
  },
  orderMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
  },
  plainTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  plainMeta: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  stock: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1,
  },
});
