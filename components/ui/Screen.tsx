import { ReactElement, ReactNode } from 'react';
import { RefreshControlProps, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  refreshControl?: ReactElement<RefreshControlProps>;
};

export function Screen({
  children,
  scrollable = true,
  padded = true,
  style,
  contentContainerStyle,
  refreshControl,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const containerStyle = [
    styles.container,
    {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    style,
  ];

  if (scrollable) {
    return (
      <ScrollView
        style={containerStyle}
        contentContainerStyle={[
          padded && styles.padded,
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}>
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[containerStyle, padded && styles.padded, contentContainerStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
});
