import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { ProductCard } from '@/components/store/ProductCard';
import { StoreBagButton } from '@/components/store/StoreBagButton';
import { StoreCatalogSidebar } from '@/components/store/StoreCatalogSidebar';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { trackStoreEvent } from '@/lib/store/analytics';
import * as store from '@/services/store';
import type { StoreCategory, StoreProduct } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

type SortKey = 'featured' | 'newest' | 'price_asc' | 'price_desc';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'featured', label: 'FEATURED' },
  { id: 'newest', label: 'NEW' },
  { id: 'price_asc', label: 'PRICE ↑' },
  { id: 'price_desc', label: 'PRICE ↓' },
];

function pairRows(items: StoreProduct[]) {
  const pairs: StoreProduct[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}

export default function StoreCatalogScreen() {
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ category?: string }>();
  const sidebarWidth = width < 400 ? 118 : width < 720 ? 140 : 168;

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('featured');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(5);
  const [showExact, setShowExact] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [cats, inv, all] = await Promise.all([
        store.listCategories(),
        store.getInventorySettings(),
        store.listProducts({ status: 'active', sort: 'featured' }),
      ]);
      const activeCats = cats.filter((c) => c.active);
      setCategories(activeCats);
      setThreshold(inv.low_stock_threshold);
      setShowExact(inv.show_exact_stock);
      setProducts(all);

      if (params.category) {
        const match = activeCats.find(
          (c) => c.slug === params.category || c.id === params.category,
        );
        if (match) setCategoryId(match.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load catalogue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.category]);

  useEffect(() => {
    void load();
    trackStoreEvent('catalog_opened');
  }, [load]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of categories) {
      map[cat.id] = products.filter(
        (p) => p.category_id === cat.id || p.category?.slug === cat.slug,
      ).length;
    }
    return map;
  }, [categories, products]);

  const filtered = useMemo(() => {
    let list = products;
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId);
      list = products.filter(
        (p) => p.category_id === categoryId || (cat && p.category?.slug === cat.slug),
      );
    }
    const next = [...list];
    if (sort === 'newest') {
      next.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
    } else if (sort === 'price_asc') {
      next.sort((a, b) => a.price_cents - b.price_cents);
    } else if (sort === 'price_desc') {
      next.sort((a, b) => b.price_cents - a.price_cents);
    } else {
      next.sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
    }
    return next;
  }, [products, categoryId, categories, sort]);

  const activeCategory = categories.find((c) => c.id === categoryId) ?? null;

  const selectCategory = (id: string | null) => {
    void Haptics.selectionAsync();
    setCategoryId(id);
    if (id) trackStoreEvent('category_selected', { category_id: id, source: 'catalog' });
  };

  if (loading && !refreshing) {
    return (
      <Screen scrollable={false} padded={false}>
        <View style={styles.pad}>
          <BackButton />
          <Skeleton height={28} width="40%" style={{ marginTop: spacing.md }} />
          <Skeleton height={420} style={{ marginTop: spacing.lg }} />
        </View>
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
      scrollable={false}
      padded={false}
      style={styles.screen}
    >
      <View style={styles.pad}>
        <View style={styles.topBar}>
          <BackButton />
          <View style={styles.topActions}>
            <StoreBagButton />
          </View>
        </View>

        <View style={styles.heading}>
          <Text style={styles.kicker}>REFORGE ESSENTIALS</Text>
          <Text style={styles.title}>CATALOGUE</Text>
          <Text style={styles.sub}>
            {activeCategory
              ? `${activeCategory.name.toUpperCase()} · ${filtered.length} PIECES`
              : `FULL DROP · ${filtered.length} PIECES`}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <StoreCatalogSidebar
          categories={categories}
          selectedId={categoryId}
          counts={categoryCounts}
          totalCount={products.length}
          onSelect={selectCategory}
          width={sidebarWidth}
        />

        <View style={styles.main}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortRow}
          >
            {SORTS.map((s) => {
              const active = sort === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSort(s.id);
                  }}
                  style={[styles.sortChip, active && styles.sortChipActive]}>
                  <Text style={[styles.sortText, active && styles.sortTextActive]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            style={styles.gridScroll}
            contentContainerStyle={styles.gridContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load();
                }}
                tintColor={colors.accent}
              />
            }
          >
            {filtered.length === 0 ? (
              <EmptyState
                icon="shirt-outline"
                title="No pieces here"
                description="Try another category or browse the full drop."
                actionLabel="Show all"
                onAction={() => selectCategory(null)}
              />
            ) : (
              pairRows(filtered).map((pair, idx) => (
                <View key={idx} style={styles.gridRow}>
                  {pair.map((p) => (
                    <View key={p.id} style={styles.gridItem}>
                      <ProductCard
                        product={p}
                        lowStockThreshold={threshold}
                        showExactStock={showExact}
                        onPress={() => router.push(`/(member)/store/${p.id}`)}
                      />
                    </View>
                  ))}
                  {pair.length === 1 ? <View style={styles.gridItem} /> : null}
                </View>
              ))
            )}
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: spacing.md,
    paddingTop: 0,
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    marginBottom: spacing.md,
    gap: 4,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.6,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 42,
    letterSpacing: 1,
    color: colors.text,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,255,0,0.14)',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(20,20,20,0.9)',
  },
  sortChipActive: {
    borderColor: 'rgba(200,255,0,0.55)',
    backgroundColor: 'rgba(200,255,0,0.14)',
  },
  sortText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  sortTextActive: {
    color: colors.accent,
  },
  gridScroll: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gridItem: {
    flex: 1,
    minWidth: 0,
  },
});
