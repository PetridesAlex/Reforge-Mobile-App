import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '@/components/store/ProductCard';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import * as commerce from '@/services/store.commerce';
import type { StoreProduct } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

export default function StoreFavoritesScreen() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setProducts(await commerce.listFavorites(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load favorites');
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
        <Skeleton height={40} width="50%" style={{ marginTop: spacing.md }} />
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

  const pairs: StoreProduct[][] = [];
  for (let i = 0; i < products.length; i += 2) pairs.push(products.slice(i, i + 2));

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
      <Text style={styles.title}>FAVORITES</Text>

      {products.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="NOTHING SAVED YET"
          description="Save your favorite pieces and find them here."
          actionLabel="BROWSE STORE"
          onAction={() => router.push('/(member)/store')}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {pairs.map((pair, idx) => (
            <View key={idx} style={styles.grid}>
              {pair.map((p) => (
                <View key={p.id} style={{ flex: 1 }}>
                  <ProductCard
                    product={p}
                    onPress={() => router.push(`/(member)/store/${p.id}`)}
                  />
                </View>
              ))}
              {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
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
  grid: { flexDirection: 'row', gap: spacing.sm },
});
