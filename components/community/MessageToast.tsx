import { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius, spacing } from '@/constants/theme';
import type { AppNotification } from '@/types';

type Props = {
  notification: AppNotification | null;
  onPress: (notification: AppNotification) => void;
  onDismiss: () => void;
};

export function MessageToast({ notification, onPress, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const visibleId = useRef<string | null>(null);

  useEffect(() => {
    if (!notification) {
      visibleId.current = null;
      Animated.timing(slide, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    const isNew = visibleId.current !== notification.id;
    visibleId.current = notification.id;

    if (isNew && Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    slide.setValue(0);
    Animated.spring(slide, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 68,
    }).start();

    const timer = setTimeout(() => onDismiss(), 4800);
    return () => clearTimeout(timer);
  }, [notification, onDismiss, slide]);

  if (!notification) return null;

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-28, 0],
  });

  const kicker =
    notification.type === 'chat_request'
      ? 'CHAT REQUEST'
      : notification.type === 'chat_invite'
        ? 'CHAT INVITE'
        : notification.type === 'community_like'
          ? 'NEW LIKE'
          : notification.type === 'community_comment'
            ? 'NEW COMMENT'
            : 'NEW MESSAGE';

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingTop: insets.top + spacing.sm }]}>
      <Animated.View
        style={[
          styles.cardWrap,
          {
            opacity: slide,
            transform: [{ translateY }, { scale: slide.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
          },
        ]}>
        <Pressable
          onPress={() => onPress(notification)}
          style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
          <LinearGradient
            colors={['rgba(30,30,30,0.98)', 'rgba(18,18,18,0.98)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}>
            <LinearGradient
              colors={['rgba(200,255,0,0.22)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.glow}
            />
            <View style={styles.accentBar} />
            <View style={styles.iconOrb}>
              <Ionicons
                name={
                  notification.type === 'community_like'
                    ? 'heart'
                    : notification.type === 'community_comment'
                      ? 'chatbubble-ellipses'
                      : 'chatbubble-ellipses'
                }
                size={20}
                color={colors.accent}
              />
            </View>
            <View style={styles.copy}>
              <Text style={styles.kicker}>{kicker}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {notification.title}
              </Text>
              <Text style={styles.body} numberOfLines={2}>
                {notification.body}
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onDismiss();
              }}
              hitSlop={12}
              style={styles.closeBtn}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: spacing.md,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  pressable: {
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.92,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    paddingLeft: spacing.md + 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  iconOrb: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  copy: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.sm,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  closeBtn: {
    marginTop: 2,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
