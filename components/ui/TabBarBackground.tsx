import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

export function TabBarBackground() {
  return (
    <View style={styles.shell}>
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
    backgroundColor: '#0B0B0B',
  },
  line: {
    height: 1.5,
    width: '100%',
  },
});
