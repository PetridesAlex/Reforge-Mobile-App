import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { getDayPeriodVisuals } from '@/lib/utils/timeOfDay';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  firstName?: string;
  /** Show the popup card on load / when the period changes */
  showPopup?: boolean;
};

export function TimeOfDayMoment({ firstName, showPopup = true }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [popupOpen, setPopupOpen] = useState(false);
  const [dismissedPeriod, setDismissedPeriod] = useState<string | null>(null);
  const slide = useRef(new Animated.Value(0)).current;

  const visuals = useMemo(() => getDayPeriodVisuals(now, firstName), [now, firstName]);
  const periodKey = `${visuals.period}-${now.toDateString()}`;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showPopup) return;
    if (dismissedPeriod === periodKey) return;
    setPopupOpen(true);
    slide.setValue(0);
    Animated.spring(slide, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();
  }, [periodKey, dismissedPeriod, showPopup, slide]);

  const dismiss = () => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPopupOpen(false);
        setDismissedPeriod(periodKey);
      }
    });
  };

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  return (
    <>
      <View style={[styles.badge, { borderColor: visuals.border }]}>
        <LinearGradient colors={visuals.gradient} style={styles.badgeGlow} />
        <View style={[styles.iconOrb, { backgroundColor: `${visuals.accent}18`, borderColor: visuals.border }]}>
          <Ionicons name={visuals.icon} size={22} color={visuals.accent} />
        </View>
        <View style={styles.badgeCopy}>
          <Text style={[styles.badgeLabel, { color: visuals.accent }]}>{visuals.label.toUpperCase()}</Text>
          <Text style={styles.badgeTitle}>{visuals.title}</Text>
        </View>
      </View>

      <Modal visible={popupOpen && showPopup} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
          <Animated.View
            style={[
              styles.popup,
              {
                opacity: slide,
                transform: [{ translateY }],
                borderColor: visuals.border,
              },
            ]}>
            <LinearGradient colors={visuals.gradient} style={styles.popupGlow} />
            <View style={styles.popupHeader}>
              <View style={[styles.popupIcon, { backgroundColor: `${visuals.accent}16`, borderColor: visuals.border }]}>
                <Ionicons name={visuals.icon} size={28} color={visuals.accent} />
              </View>
              <Pressable onPress={dismiss} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.popupKicker, { color: visuals.accent }]}>
              {visuals.label.toUpperCase()} · {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.popupTitle}>{visuals.title}</Text>
            <Text style={styles.popupMessage}>{visuals.message}</Text>
            <Pressable
              onPress={dismiss}
              style={[styles.popupBtn, { backgroundColor: `${visuals.accent}22`, borderColor: visuals.border }]}>
              <Text style={[styles.popupBtnText, { color: visuals.accent }]}>Let's go</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

export function useTimeOfDayGradient(firstName?: string) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => getDayPeriodVisuals(now, firstName), [now, firstName]);
}

const styles = StyleSheet.create({
  badge: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm,
  },
  badgeGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  iconOrb: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCopy: {
    flex: 1,
    gap: 2,
  },
  badgeLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  badgeTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  popup: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: '#0C0C0C',
    padding: spacing.lg,
    gap: spacing.sm,
    zIndex: 1,
  },
  popupGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  popupIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  popupKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  popupTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  popupMessage: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  popupBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  popupBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    letterSpacing: 0.4,
  },
});
