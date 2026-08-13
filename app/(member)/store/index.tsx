import { router } from 'expo-router';
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
import { StoreCategoryChips } from '@/components/store/StoreCategoryChips';
import { StoreHero } from '@/components/store/StoreHero';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { GraffitiWordmark } from '@/components/ui/GraffitiWordmark';
import { MoreMenu } from '@/components/ui/MoreMenu';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { trackStoreEvent } from '@/lib/store/analytics';
import * as store from '@/services/store';
import type { StoreCategory, StoreHomeHero, StoreProduct } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

function pairRows(items: StoreProduct[]) {
  const pairs: StoreProduct[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}

export default function MemberStoreHome() {
  const { width } = useWindowDimensions();

  const [hero, setHero] = useState<StoreHomeHero | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [featured, setFeatured] = useState<StoreProduct[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(5);
  const [showExact, setShowExact] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [h, cats, inv, all, feat] = await Promise.all([
        store.getHomeHero(),
        store.listCategories(),
        store.getInventorySettings(),
        store.listProducts({
          status: 'active',
          sort: 'featured',
        }),
        store.listProducts({ status: 'active', featuredOnly: true, sort: 'newest', limit: 8 }),
      ]);
      setHero(h);
      setCategories(cats.filter((c) => c.active));
      setThreshold(inv.low_stock_threshold);
      setShowExact(inv.show_exact_stock);
      setProducts(all);
      setFeatured(feat);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load store');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    trackStoreEvent('store_opened');
  }, [load]);

  const heroImage = featured[0]?.primary_image_url ?? products[0]?.primary_image_url ?? null;

  const productsByCategory = useMemo(() => {
    return categories.map((cat) => ({
      category: cat,
      items: products.filter((p) => p.category_id === cat.id || p.category?.slug === cat.slug).slice(0, 3),
    }));
  }, [categories, products]);

  const filtered = useMemo(() => {
    if (!categoryId) return products;
    const cat = categories.find((c) => c.id === categoryId);
    return products.filter(
      (p) => p.category_id === categoryId || (cat && p.category?.slug === cat.slug),
    );
  }, [products, categoryId, categories]);

  const cardWidth = Math.min(168, Math.max(148, (width - spacing.md * 2 - spacing.sm * 2) / 2.35));

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of categories) {
      map[cat.id] = products.filter(
        (p) => p.category_id === cat.id || p.category?.slug === cat.slug,
      ).length;
    }
    return map;
  }, [categories, products]);

  const selectCategory = (id: string | null) => {
    void Haptics.selectionAsync();
    setCategoryId(id);
    if (id) trackStoreEvent('category_selected', { category_id: id });
  };

  const shopCollection = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackStoreEvent('catalog_opened', { source: 'hero' });
    router.push('/(member)/store/catalog');
  };

  if (loading && !refreshing) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <BackButton />
          <MoreMenu />
        </View>
        <Skeleton height={48} width="40%" style={{ marginTop: spacing.md }} />
        <Skeleton height={320} style={{ marginTop: spacing.lg, borderRadius: radius.xl }} />
        <Skeleton height={220} style={{ marginTop: spacing.lg }} />
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
      }
    >
      <View style={styles.topBar}>
        <BackButton />
        <View style={styles.topActions}>
          <StoreBagButton />
          <MoreMenu />
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.brandKicker}>{hero?.kicker ?? 'REFORGE'}</Text>
        <GraffitiWordmark text={hero?.title ?? 'STORE'} size={68} delay={80} />
        <View style={styles.titleSlash} />
      </View>

      <StoreHero
        hero={
          hero ?? {
            kicker: 'REFORGE',
            title: 'STORE',
            headline: 'REFORGE ESSENTIALS',
            subtitle: 'Forged under load. Cut for the work. No soft layers.',
            cta: 'SHOP COLLECTION',
          }
        }
        imageUri={heroImage}
        onShop={shopCollection}
      />

      <SectionHeader title="CATEGORIES" kicker="FILTER" />
      <StoreCategoryChips
        categories={categories}
        selectedId={categoryId}
        counts={categoryCounts}
        totalCount={products.length}
        onSelect={selectCategory}
      />

      {categoryId == null ? (
        <>
          {featured.length > 0 ? (
            <>
              <SectionHeader title="FEATURED" kicker="DROP" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}>
                {featured.slice(0, 4).map((p) => (
                  <View key={p.id} style={{ width: cardWidth }}>
                    <ProductCard
                      product={p}
                      lowStockThreshold={threshold}
                      showExactStock={showExact}
                      onPress={() => router.push(`/(member)/store/${p.id}`)}
                    />
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}

          {productsByCategory.map(({ category, items }) =>
            items.length === 0 ? null : (
              <View key={category.id} style={styles.categoryBlock}>
                <SectionHeader
                  title={category.name.toUpperCase()}
                  actionLabel="VIEW ALL"
                  onActionPress={() => {
                    void Haptics.selectionAsync();
                    router.push({
                      pathname: '/(member)/store/catalog',
                      params: { category: category.slug },
                    });
                  }}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}>
                  {items.map((p) => (
                    <View key={p.id} style={{ width: cardWidth }}>
                      <ProductCard
                        product={p}
                        lowStockThreshold={threshold}
                        showExactStock={showExact}
                        onPress={() => router.push(`/(member)/store/${p.id}`)}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ),
          )}

          {products.length === 0 ? (
            <EmptyState
              icon="bag-outline"
              title="Nothing here yet"
              description="New REFORGE pieces will appear when published."
            />
          ) : null}
        </>
      ) : (
        <>
          <SectionHeader
            title={categories.find((c) => c.id === categoryId)?.name.toUpperCase() ?? 'COLLECTION'}
          />
          {filtered.length === 0 ? (
            <EmptyState
              icon="shirt-outline"
              title="No pieces in this category"
              description="Check back soon or browse the full collection."
              actionLabel="Shop all"
              onAction={() => selectCategory(null)}
            />
          ) : (
            <View style={styles.stack}>
              {pairRows(filtered).map((pair, idx) => (
                <View key={idx} style={styles.grid}>
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
              ))}
            </View>
          )}
        </>
      )}
      <View style={{ height: spacing.xxl }} />
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
    zIndex: 2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 8,
  },
  brandKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.accent,
  },
  titleBlock: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    gap: 6,
  },
  titleSlash: {
    width: 56,
    height: 3,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  rail: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingRight: spacing.md,
  },
  categoryBlock: {
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gridItem: { flex: 1 },
  stack: { marginBottom: spacing.lg },
});
