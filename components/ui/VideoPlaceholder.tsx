import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { MediaImage } from '@/components/ui/MediaImage';
import { colors, radius, spacing, typography } from '@/constants/theme';

type VideoPlaceholderProps = {
  posterUri?: string | null;
  label?: string;
  style?: ViewStyle;
  onPress?: () => void;
};

/** Visual slot for demo videos — replace with real player + video_url later. */
export function VideoPlaceholder({
  posterUri,
  label = 'Form video · replace with real clip',
  style,
  onPress,
}: VideoPlaceholderProps) {
  return (
    <Pressable onPress={onPress} style={[styles.wrap, style]}>
      <MediaImage uri={posterUri} style={StyleSheet.absoluteFillObject as ViewStyle} overlay />
      <LinearGradient
        colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.65)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.play}>
        <Ionicons name="play" size={22} color={colors.background} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
