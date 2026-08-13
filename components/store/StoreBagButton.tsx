import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { useStoreCart } from '@/hooks/useStoreCart';
import { colors, fonts } from '@/constants/theme';

export function StoreBagButton() {
  const { count } = useStoreCart();
  return (
    <HeaderIconButton
      icon="bag-handle-outline"
      accessibilityLabel={count > 0 ? `Bag, ${count} items` : 'Bag'}
      onPress={() => router.push('/(member)/store/cart')}
      badge={
        count > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.background,
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    lineHeight: 11,
    color: colors.background,
  },
});
