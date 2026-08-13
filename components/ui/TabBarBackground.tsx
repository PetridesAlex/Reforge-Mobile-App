import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

/** Fallback background for native tab bar configs that still reference this helper. */
export function TabBarBackground() {
  return (
    <View style={styles.shell}>
      <LinearGradient
        colors={['#121212', '#0A0A0A', '#050505']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(200,255,0,0.28)', 'rgba(200,255,0,0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.line}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    overflow: 'hidden',
  },
  line: {
    height: 1.5,
    width: '100%',
  },
});
