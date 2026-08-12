import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

type LoadingOverlayProps = {
  visible?: boolean;
};

export function LoadingOverlay({ visible = true }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
