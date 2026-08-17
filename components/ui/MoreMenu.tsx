import { useEffect, useState } from 'react';
import {
  Dimensions,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { STUDIO, studioAddressLines } from '@/constants/studio';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { MenuIcon } from '@/components/ui/MenuIcon';

type MenuIcon = React.ComponentProps<typeof Ionicons>['name'];

export type MoreMenuItem = {
  id: string;
  label: string;
  description: string;
  icon: MenuIcon;
  href: string;
};

const MEMBER_MENU_ITEMS: readonly MoreMenuItem[] = [
  {
    id: 'challenges',
    label: 'Weekly Challenge',
    description: 'Compete on this week’s workout',
    icon: 'trophy-outline',
    href: '/(member)/challenges',
  },
  {
    id: 'league',
    label: 'REFORGE League',
    description: 'Bronze → Elite weekly divisions',
    icon: 'podium-outline',
    href: '/(member)/league',
  },
  {
    id: 'achievements',
    label: 'Achievements',
    description: 'Level, XP, and unlocked badges',
    icon: 'ribbon-outline',
    href: '/(member)/achievements',
  },
  {
    id: 'prs',
    label: 'My PRs',
    description: 'Personal records catalog',
    icon: 'flash-outline',
    href: '/(member)/progress/prs',
  },
  {
    id: 'store',
    label: 'Store',
    description: 'REFORGE merchandise',
    icon: 'bag-handle-outline',
    href: '/(member)/store',
  },
  {
    id: 'sessions',
    label: 'Sessions',
    description: 'Private lessons & classes',
    icon: 'calendar-outline',
    href: '/(member)/bookings',
  },
  {
    id: 'chat',
    label: 'Messages',
    description: 'DMs & group chats from Community',
    icon: 'chatbubbles-outline',
    href: '/(member)/messages',
  },
  {
    id: 'book',
    label: 'Book session',
    description: 'Reserve a slot with your coach',
    icon: 'add-circle-outline',
    href: '/(member)/bookings/new',
  },
];

export const ADMIN_MENU_ITEMS: readonly MoreMenuItem[] = [
  {
    id: 'community',
    label: 'Community',
    description: 'Feed, posts & gym activity',
    icon: 'people-outline',
    href: '/(coach)/community',
  },
  {
    id: 'community-mod',
    label: 'Moderate community',
    description: 'Pin, hide or remove posts',
    icon: 'shield-checkmark-outline',
    href: '/(coach)/admin/community',
  },
  {
    id: 'chat',
    label: 'Class chats',
    description: 'Message afternoon groups',
    icon: 'chatbubbles-outline',
    href: '/(coach)/messages',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Sessions & bookings',
    icon: 'calendar-outline',
    href: '/(coach)/calendar',
  },
  {
    id: 'members',
    label: 'Members',
    description: 'Roster & client profiles',
    icon: 'people-outline',
    href: '/(coach)/clients',
  },
  {
    id: 'wod',
    label: 'WOD',
    description: 'Workout of the day',
    icon: 'flash-outline',
    href: '/(coach)/admin/wod',
  },
  {
    id: 'classes',
    label: 'Classes',
    description: 'Group & private sessions',
    icon: 'fitness-outline',
    href: '/(coach)/admin/classes',
  },
  {
    id: 'memberships',
    label: 'Memberships',
    description: 'Paid & unpaid status',
    icon: 'card-outline',
    href: '/(coach)/admin/memberships',
  },
  {
    id: 'store',
    label: 'Store',
    description: 'Merch, products & inventory',
    icon: 'bag-handle-outline',
    href: '/(coach)/admin/store',
  },
  {
    id: 'news',
    label: 'Studio news',
    description: 'Posts for members',
    icon: 'newspaper-outline',
    href: '/(coach)/admin/news',
  },
  {
    id: 'challenges',
    label: 'Challenges',
    description: 'Weekly competitions & verification',
    icon: 'trophy-outline',
    href: '/(coach)/challenges',
  },
  {
    id: 'achievements-mgr',
    label: 'Achievements',
    description: 'Catalog & manual awards',
    icon: 'ribbon-outline',
    href: '/(coach)/achievements',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Hours, access & studio',
    icon: 'settings-outline',
    href: '/(coach)/admin/settings',
  },
  {
    id: 'profile',
    label: 'Profile',
    description: 'Your account & sign out',
    icon: 'person-outline',
    href: '/(coach)/profile',
  },
];

type MoreMenuProps = {
  compact?: boolean;
  items?: readonly MoreMenuItem[];
  title?: string;
  showStudioCard?: boolean;
};

const SHEET_MAX_HEIGHT = Math.min(Dimensions.get('window').height * 0.82, 720);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function MenuRow({
  item,
  index,
  onPress,
}: {
  item: MoreMenuItem;
  index: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 70).duration(420).springify().damping(18)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 16, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 280 });
        }}
        style={[styles.row, animatedStyle]}>
        <LinearGradient
          colors={['rgba(200,255,0,0.18)', 'rgba(200,255,0,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBox}>
          <Ionicons name={item.icon} size={18} color={colors.accent} />
        </LinearGradient>
        <View style={styles.copy}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.desc}>{item.description}</Text>
        </View>
        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export function MoreMenu({
  compact = false,
  items = MEMBER_MENU_ITEMS,
  title = 'More',
  showStudioCard = true,
}: MoreMenuProps) {
  const [visible, setVisible] = useState(false);
  const openProgress = useSharedValue(0);
  const triggerScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      openProgress.value = withSpring(1, { damping: 20, stiffness: 240 });
    }
  }, [visible, openProgress]);

  const close = () => {
    openProgress.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(setVisible)(false);
    });
  };

  const open = () => {
    setVisible(true);
  };

  const openMaps = () => {
    const url = `https://maps.apple.com/?q=${encodeURIComponent(STUDIO.mapsQuery)}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(STUDIO.mapsQuery)}`,
      );
    });
  };

  const callStudio = () => {
    Linking.openURL(`tel:${STUDIO.phoneE164}`);
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [0, 1]),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 0.4, 1], [0, 0.85, 1]),
    transform: [
      { translateX: interpolate(openProgress.value, [0, 1], [36, 0]) },
      { scale: interpolate(openProgress.value, [0, 1], [0.96, 1]) },
    ],
  }));

  const triggerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: triggerScale.value }],
  }));

  return (
    <>
      <AnimatedPressable
        onPress={open}
        onPressIn={() => {
          triggerScale.value = withSpring(0.92, { damping: 14, stiffness: 360 });
        }}
        onPressOut={() => {
          triggerScale.value = withSpring(1, { damping: 12, stiffness: 300 });
        }}
        hitSlop={10}
        style={[styles.trigger, compact && styles.triggerCompact, triggerStyle]}
        accessibilityLabel="Open menu">
        <LinearGradient
          colors={['rgba(200,255,0,0.22)', 'rgba(200,255,0,0.08)']}
          style={styles.triggerGradient}>
          <MenuIcon size={20} color={colors.accent} />
        </LinearGradient>
      </AnimatedPressable>

      <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
        <View style={styles.modalRoot}>
          <AnimatedPressable style={[styles.backdrop, backdropStyle]} onPress={close} accessibilityLabel="Close menu" />

          <Animated.View style={[styles.sheet, { maxHeight: SHEET_MAX_HEIGHT }, sheetStyle]}>
            <LinearGradient
              colors={['rgba(200,255,0,0.35)', 'rgba(200,255,0,0.04)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sheetGlow}
            />

            <View style={styles.sheetHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.sheetKicker}>REFORGE</Text>
                <Text style={styles.sheetTitle}>{title}</Text>
                <View style={styles.headerRule} />
              </View>
              <Pressable
                onPress={close}
                hitSlop={12}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled">
              <View style={styles.menuBlock}>
                {items.map((item, index) => (
                  <MenuRow
                    key={item.id}
                    item={item}
                    index={index}
                    onPress={() => {
                      close();
                      setTimeout(() => router.push(item.href as never), 240);
                    }}
                  />
                ))}
              </View>

              {showStudioCard ? (
                <Animated.View entering={FadeIn.delay(320).duration(500)}>
                  <LinearGradient
                    colors={['#1A1A12', '#121210', '#0E0E0E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.studioCard}>
                    <LinearGradient
                      colors={['rgba(200,255,0,0.28)', 'rgba(200,255,0,0.04)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.studioCardBorder}
                    />

                    <View style={styles.studioTop}>
                      <View style={styles.pinPulse}>
                        <LinearGradient
                          colors={['rgba(200,255,0,0.35)', 'rgba(200,255,0,0.12)']}
                          style={styles.pinBox}>
                          <Ionicons name="location" size={16} color={colors.accent} />
                        </LinearGradient>
                      </View>
                      <View style={styles.studioHeading}>
                        <Text style={styles.studioKicker}>FIND THE STUDIO</Text>
                        <Text style={styles.studioVenue}>{STUDIO.venue}</Text>
                      </View>
                    </View>

                    <View style={styles.addressBlock}>
                      {studioAddressLines()
                        .slice(1)
                        .map((line) => (
                          <Text key={line} style={styles.addressLine}>
                            {line}
                          </Text>
                        ))}
                    </View>

                    <Pressable
                      onPress={openMaps}
                      style={({ pressed }) => [styles.mapsBtnOuter, pressed && styles.pressed]}>
                      <LinearGradient
                        colors={[colors.accent, '#A8E600']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.mapsBtn}>
                        <Ionicons name="navigate" size={14} color={colors.background} />
                        <Text style={styles.mapsBtnText}>Open in Maps</Text>
                      </LinearGradient>
                    </Pressable>

                    <View style={styles.divider} />

                    <Pressable
                      onPress={callStudio}
                      style={({ pressed }) => [styles.contactRow, pressed && styles.rowPressed]}>
                      <LinearGradient
                        colors={['rgba(200,255,0,0.2)', 'rgba(200,255,0,0.06)']}
                        style={styles.contactIcon}>
                        <Ionicons name="call" size={14} color={colors.accent} />
                      </LinearGradient>
                      <View style={styles.contactCopy}>
                        <Text style={styles.contactName}>{STUDIO.owner}</Text>
                        <Text style={styles.contactPhone}>{STUDIO.phoneDisplay}</Text>
                      </View>
                      <View style={styles.callPill}>
                        <Text style={styles.callHint}>Call</Text>
                      </View>
                    </Pressable>
                  </LinearGradient>
                </Animated.View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.32)',
  },
  triggerCompact: {
    width: 44,
    height: 44,
  },
  triggerGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  pressed: { opacity: 0.88 },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 72,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0A0A0A',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.24)',
    overflow: 'hidden',
    flexDirection: 'column',
    shadowColor: colors.accent,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: -4, height: 8 },
    elevation: 12,
  },
  sheetGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  sheetScroll: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  sheetScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 1,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerRule: {
    marginTop: spacing.sm,
    width: 42,
    height: 2,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  sheetKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 2.8,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    color: colors.text,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBlock: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rowPressed: {
    backgroundColor: colors.accentMuted,
    borderColor: 'rgba(200,255,0,0.18)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 3 },
  label: {
    fontFamily: fonts.sansSemiBold,
    color: colors.text,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  desc: {
    fontFamily: fonts.sans,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.16)',
  },
  studioCardBorder: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  studioTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 1,
  },
  pinPulse: {
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  pinBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioHeading: {
    flex: 1,
    gap: 2,
  },
  studioKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 2,
  },
  studioVenue: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.3,
  },
  addressBlock: {
    gap: 2,
    paddingLeft: 2,
    zIndex: 1,
  },
  addressLine: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  mapsBtnOuter: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
    zIndex: 1,
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  mapsBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.background,
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 4,
    zIndex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    zIndex: 1,
  },
  contactIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCopy: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  contactPhone: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.4,
  },
  callPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  callHint: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
