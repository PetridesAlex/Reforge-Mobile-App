import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { AppCard } from '@/components/ui/AppCard';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LiveDateTime } from '@/components/ui/LiveDateTime';
import { TimeOfDayMoment, useTimeOfDayGradient } from '@/components/ui/TimeOfDayMoment';
import { ADMIN_MENU_ITEMS, MoreMenu } from '@/components/ui/MoreMenu';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { canManageStudio } from '@/lib/permissions';
import { STUDIO } from '@/constants/studio';
import * as adminService from '@/services/admin';
import * as coachService from '@/services/coach';
import type { CoachDashboard, Profile } from '@/types';
import type { StudioSettings } from '@/services/mock/data';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const KPI_ITEMS = [
  { key: 'members', label: 'Members', icon: 'people-outline' as const },
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar-outline' as const },
  { key: 'staff', label: 'Staff', icon: 'shield-outline' as const },
  { key: 'open', label: 'Open days', icon: 'time-outline' as const },
] as const;

type ActionIcon = React.ComponentProps<typeof Ionicons>['name'];

type Action = {
  key: string;
  title: string;
  meta: string;
  href: string;
  icon: ActionIcon;
  accent?: boolean;
};

const ADMIN_ACTIONS: Action[] = [
  {
    key: 'memberships',
    title: 'Memberships',
    meta: 'Paid & unpaid',
    href: '/(coach)/admin/memberships',
    icon: 'card-outline',
    accent: true,
  },
  {
    key: 'store',
    title: 'Store',
    meta: 'Merch & inventory',
    href: '/(coach)/admin/store',
    icon: 'bag-handle-outline',
    accent: true,
  },
  {
    key: 'classes',
    title: 'Classes',
    meta: 'Group & private',
    href: '/(coach)/admin/classes',
    icon: 'fitness-outline',
    accent: true,
  },
  {
    key: 'athletes',
    title: 'Athletes',
    meta: 'Adherence dashboard',
    href: '/(coach)/athletes',
    icon: 'pulse-outline',
    accent: true,
  },
  {
    key: 'chat',
    title: 'Messages',
    meta: 'Athletes & class groups',
    href: '/(coach)/messages',
    icon: 'chatbubbles-outline',
    accent: true,
  },
  {
    key: 'wod',
    title: 'WOD',
    meta: 'Workout of the day',
    href: '/(coach)/admin/wod',
    icon: 'flash-outline',
  },
  {
    key: 'workouts',
    title: 'Workouts',
    meta: 'Plan each day',
    href: '/(coach)/programs',
    icon: 'barbell-outline',
  },
  {
    key: 'schedule',
    title: 'Schedule',
    meta: 'Week plan',
    href: '/(coach)/admin/schedule',
    icon: 'calendar-outline',
  },
  {
    key: 'members',
    title: 'Members',
    meta: 'Roster & invites',
    href: '/(coach)/clients',
    icon: 'people-outline',
  },
  {
    key: 'news',
    title: 'News',
    meta: 'Studio posts',
    href: '/(coach)/admin/news',
    icon: 'newspaper-outline',
  },
  {
    key: 'challenges',
    title: 'Challenges',
    meta: 'Weekly competition',
    href: '/(coach)/challenges',
    icon: 'trophy-outline',
    accent: true,
  },
  {
    key: 'achievements',
    title: 'Achievements',
    meta: 'Awards & catalog',
    href: '/(coach)/achievements',
    icon: 'ribbon-outline',
  },
  {
    key: 'staff',
    title: 'Staff',
    meta: 'Coaches & roles',
    href: '/(coach)/admin/staff',
    icon: 'shield-outline',
  },
  {
    key: 'settings',
    title: 'Settings',
    meta: 'Hours & access',
    href: '/(coach)/admin/settings',
    icon: 'settings-outline',
  },
];

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function statusTone(status: string): 'ok' | 'warn' | 'muted' {
  const s = status.toLowerCase();
  if (s === 'confirmed' || s === 'scheduled' || s === 'completed') return 'ok';
  if (s === 'pending') return 'warn';
  return 'muted';
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusVisuals(status: string) {
  const tone = statusTone(status);
  if (tone === 'ok') {
    return {
      pillBg: 'rgba(74,222,128,0.12)',
      pillBorder: 'rgba(74,222,128,0.35)',
      text: colors.success,
      icon: 'checkmark-circle-outline' as const,
    };
  }
  if (tone === 'warn') {
    return {
      pillBg: 'rgba(250,204,21,0.12)',
      pillBorder: 'rgba(250,204,21,0.4)',
      text: '#FACC15',
      icon: 'time-outline' as const,
    };
  }
  return {
    pillBg: 'rgba(255,255,255,0.06)',
    pillBorder: colors.border,
    text: colors.textMuted,
    icon: 'ellipse-outline' as const,
  };
}

export default function CoachDashboardScreen() {
  const { profile } = useAuth();
  const isAdmin = canManageStudio(profile?.role);
  const studioMenuItems = ADMIN_MENU_ITEMS.filter(
    (item) => item.id !== 'community-mod' || isAdmin,
  );
  const [data, setData] = useState<CoachDashboard | null>(null);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Coach';
  const timeVisuals = useTimeOfDayGradient(firstName);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const [dashboard, studioStaff, studioSettings, members] = await Promise.all([
        coachService.getCoachDashboard(profile.id, { studioWide: isAdmin }),
        isAdmin ? coachService.getStudioStaff() : Promise.resolve([]),
        isAdmin ? adminService.getStudioSettings() : Promise.resolve(null),
        isAdmin ? adminService.listMembers() : Promise.resolve([]),
      ]);
      setData(dashboard);
      setStaff(studioStaff);
      setSettings(studioSettings);
      setMemberCount(members.filter((m) => m.active).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={180} style={{ marginTop: spacing.md }} />
        <Skeleton height={88} style={{ marginTop: spacing.md }} />
        <Skeleton height={160} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <ErrorState message={error ?? 'No data'} onRetry={load} />
      </Screen>
    );
  }

  if (isAdmin) {
    const openDays = settings?.workingDays.length ?? 0;
    const kpiValues: Record<(typeof KPI_ITEMS)[number]['key'], number> = {
      members: memberCount || data.activeClients,
      upcoming: data.upcomingBookings,
      staff: staff.length,
      open: openDays,
    };

    return (
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.accent}
          />
        }>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroCard}>
            <LinearGradient
              colors={timeVisuals.gradient}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.heroGlow}
            />
            <View style={styles.heroTopBar}>
              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => router.push('/(coach)/messages')}
                  hitSlop={10}
                  style={({ pressed }) => [styles.heroIconBtn, pressed && styles.pressed]}
                  accessibilityLabel="Open class chats">
                  <Ionicons name="chatbubbles-outline" size={20} color={colors.accent} />
                </Pressable>
                <MoreMenu items={studioMenuItems} title="Studio" />
                <View style={styles.heroAvatarWrap}>
                  <Avatar
                    name={profile?.full_name ?? 'Andreas Petrides'}
                    uri={profile?.avatar_url}
                    size={40}
                    onPress={() => router.push('/(coach)/profile')}
                  />
                </View>
              </View>
            </View>
            <View style={styles.heroInner}>
              <TimeOfDayMoment firstName={firstName} />
              <LiveDateTime />
              <View style={styles.heroWelcomeBlock}>
                <Text style={styles.heroKicker}>Owner · Limassol</Text>
                <Text style={styles.heroWelcomeLine}>Welcome to</Text>
                <Text style={styles.heroBrand}>REFORGE</Text>
                <View style={styles.heroRule} />
                <Text style={styles.heroPersonal}>
                  <Text style={styles.heroPersonalLead}>Good to see you, </Text>
                  <Text style={styles.heroPersonalName}>{firstName}</Text>
                </Text>
                <View style={styles.heroVenuePill}>
                  <Ionicons name="location-outline" size={12} color={colors.accent} />
                  <Text style={styles.heroVenue}>
                    {STUDIO.venue.toUpperCase()} · {STUDIO.street.toUpperCase()}, {STUDIO.city.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* KPI tiles */}
        <View style={styles.kpiGrid}>
          {KPI_ITEMS.map((item, index) => (
            <View key={item.key} style={[styles.kpiCard, index === 0 && styles.kpiCardFeatured]}>
              {index === 0 ? (
                <LinearGradient
                  colors={['rgba(200,255,0,0.1)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.kpiGlow}
                />
              ) : null}
              <View style={[styles.kpiIconWrap, index === 0 && styles.kpiIconWrapFeatured]}>
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={index === 0 ? colors.accent : colors.textSecondary}
                />
              </View>
              <AnimatedCount
                value={kpiValues[item.key]}
                style={[styles.kpiValue, index === 0 && styles.kpiValueFeatured]}
                duration={900}
              />
              <Text style={styles.kpiLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Hours strip */}
        {settings ? (
          <Pressable
            onPress={() => router.push('/(coach)/admin/settings')}
            style={({ pressed }) => [styles.hoursStrip, pressed && styles.hoursStripPressed]}>
            <LinearGradient
              colors={['rgba(200,255,0,0.05)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.hoursGlow}
            />
            <View style={styles.hoursIconWrap}>
              <Ionicons name="time-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.hoursCopy}>
              <Text style={styles.hoursKicker}>STUDIO HOURS</Text>
              <Text style={styles.hoursMeta}>
                {settings.openTime} – {settings.closeTime}
              </Text>
            </View>
            <View style={styles.weekDots}>
              {WEEKDAYS.map((label, idx) => {
                const on = settings.workingDays.includes(idx);
                return (
                  <View key={`${label}-${idx}`} style={[styles.weekDot, on && styles.weekDotOn]}>
                    <Text style={[styles.weekDotText, on && styles.weekDotTextOn]}>{label}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.hoursChevron}>›</Text>
          </Pressable>
        ) : null}

        {/* Primary actions */}
        <SectionHeader title="Manage" kicker="Studio" />
        <View style={styles.actionGrid}>
          {ADMIN_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => router.push(action.href as never)}
              style={({ pressed }) => [
                styles.actionTile,
                action.accent && styles.actionTileAccent,
                pressed && styles.actionTilePressed,
              ]}>
              {action.accent ? (
                <LinearGradient
                  colors={['rgba(200,255,0,0.14)', 'rgba(200,255,0,0.03)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionTileGlow}
                />
              ) : null}
              {action.accent ? <View style={styles.actionAccentRail} /> : null}
              <View style={[styles.actionIconWrap, action.accent && styles.actionIconWrapAccent]}>
                <Ionicons
                  name={action.icon}
                  size={18}
                  color={action.accent ? colors.accent : colors.textSecondary}
                />
              </View>
              <View style={styles.actionCopy}>
                <Text
                  style={[styles.actionTitle, action.accent && styles.actionTitleAccent]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}>
                  {action.title}
                </Text>
                <Text style={styles.actionMeta} numberOfLines={1}>
                  {action.meta}
                </Text>
              </View>
              <Text style={[styles.actionArrow, action.accent && styles.actionArrowAccent]}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* Today */}
        <View style={styles.sectionHead}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionKicker}>SCHEDULE</Text>
            <Text style={styles.sectionTitle}>Today&apos;s sessions</Text>
            <Text style={styles.sectionSub}>
              {data.todaySessions.length} on the floor today
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(coach)/calendar')}
            hitSlop={8}
            style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}>
            <Text style={styles.sectionActionText}>Calendar</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </Pressable>
        </View>
        {data.todaySessions.length === 0 ? (
          <View style={styles.sessionsEmpty}>
            <EmptyState title="No sessions today" />
          </View>
        ) : (
          <View style={styles.sessionsList}>
            {data.todaySessions.map((s) => {
              const tone = statusTone(s.status);
              const statusUi = statusVisuals(s.status);
              const isGroup = s.kind === 'group';
              return (
                <Pressable
                  key={s.id}
                  onPress={() => router.push('/(coach)/calendar')}
                  style={({ pressed }) => [
                    styles.sessionCard,
                    tone === 'ok' && styles.sessionCardOk,
                    tone === 'warn' && styles.sessionCardWarn,
                    pressed && styles.sessionCardPressed,
                  ]}>
                  <LinearGradient
                    colors={
                      isGroup
                        ? ['rgba(96,165,250,0.08)', 'transparent']
                        : ['rgba(200,255,0,0.07)', 'transparent']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sessionGlow}
                  />
                  <View
                    style={[
                      styles.sessionRail,
                      tone === 'ok' && styles.sessionRailOk,
                      tone === 'warn' && styles.sessionRailWarn,
                      isGroup && styles.sessionRailGroup,
                    ]}
                  />
                  <View style={styles.sessionTimeBlock}>
                    <Text style={styles.sessionTime}>{s.time.replace(/\s*(AM|PM)/i, '')}</Text>
                    <Text style={styles.sessionMeridiem}>
                      {/PM/i.test(s.time) ? 'PM' : 'AM'}
                    </Text>
                  </View>
                  <View style={[styles.sessionAvatar, isGroup && styles.sessionAvatarGroup]}>
                    <Text style={[styles.sessionInitials, isGroup && styles.sessionInitialsGroup]}>
                      {isGroup ? 'G' : initials(s.clientName)}
                    </Text>
                  </View>
                  <View style={styles.sessionCopy}>
                    <View style={styles.sessionTitleRow}>
                      <Text style={styles.sessionName} numberOfLines={1}>
                        {isGroup ? s.title : s.clientName}
                      </Text>
                      <View style={[styles.kindPill, isGroup && styles.kindPillGroup]}>
                        <Ionicons
                          name={isGroup ? 'people-outline' : 'person-outline'}
                          size={10}
                          color={isGroup ? '#93C5FD' : colors.accent}
                        />
                        <Text style={[styles.kindPillText, isGroup && styles.kindPillTextGroup]}>
                          {isGroup ? 'Group' : 'Private'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sessionMetaRow}>
                      <Ionicons name="barbell-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.sessionHint} numberOfLines={1}>
                        {isGroup ? s.title : s.title}
                      </Text>
                    </View>
                    <View style={styles.sessionMetaRow}>
                      <Ionicons name="person-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.sessionHint} numberOfLines={1}>
                        {isGroup ? `${s.clientName} · Coach ${s.coachName}` : s.coachName}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sessionAside}>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: statusUi.pillBg, borderColor: statusUi.pillBorder },
                      ]}>
                      <Ionicons name={statusUi.icon} size={11} color={statusUi.text} />
                      <Text style={[styles.statusText, { color: statusUi.text }]}>
                        {formatStatusLabel(s.status)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Attention */}
        <View style={styles.attentionHead}>
          <LinearGradient
            colors={['rgba(250,204,21,0.1)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.attentionHeadGlow}
          />
          <View style={styles.attentionHeadRow}>
            <View style={styles.attentionHeadIcon}>
              <Ionicons name="alert-circle-outline" size={20} color="#FACC15" />
            </View>
            <View style={styles.attentionHeadCopy}>
              <Text style={styles.attentionKicker}>MEMBER CARE</Text>
              <Text style={styles.attentionTitle}>Needs attention</Text>
              <Text style={styles.attentionSub}>
                {data.attentionClients.length === 0
                  ? 'Everyone is on track'
                  : `${data.attentionClients.length} athlete${data.attentionClients.length === 1 ? '' : 's'} to follow up`}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(coach)/clients')}
              hitSlop={8}
              style={({ pressed }) => [styles.attentionAction, pressed && styles.pressed]}>
              <Text style={styles.attentionActionText}>Roster</Text>
            </Pressable>
          </View>
        </View>
        {data.attentionClients.length === 0 ? (
          <View style={styles.attentionEmpty}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            <Text style={styles.attentionEmptyTitle}>All members on track</Text>
            <Text style={styles.attentionEmptySub}>No one is overdue on training check-ins.</Text>
          </View>
        ) : (
          <View style={styles.attentionList}>
            {data.attentionClients.map((c) => {
              const daysMatch = c.reason.match(/(\d+)\s*day/i);
              const daysLabel = daysMatch ? `${daysMatch[1]}d` : '!';
              return (
                <Pressable
                  key={c.memberId}
                  onPress={() => router.push(`/(coach)/clients/${c.memberId}`)}
                  style={({ pressed }) => [styles.attentionCard, pressed && styles.pressed]}>
                  <LinearGradient
                    colors={['rgba(250,204,21,0.08)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.attentionGlow}
                  />
                  <View style={styles.attentionDaysBadge}>
                    <Text style={styles.attentionDaysValue}>{daysLabel}</Text>
                    <Text style={styles.attentionDaysLabel}>idle</Text>
                  </View>
                  <View style={styles.attentionAvatar}>
                    <Text style={styles.attentionInitials}>{initials(c.name)}</Text>
                  </View>
                  <View style={styles.attentionCopy}>
                    <Text style={styles.attentionName}>{c.name}</Text>
                    <View style={styles.attentionReasonRow}>
                      <Ionicons name="barbell-outline" size={12} color="#FACC15" />
                      <Text style={styles.attentionReason}>{c.reason}</Text>
                    </View>
                    <Text style={styles.attentionCta}>Tap to review profile</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.accent}
        />
      }>
      <ReforgeLogo width={140} height={36} variant="badge" style={styles.logo} />
      <Text style={styles.badge}>COACH DASHBOARD</Text>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Limassol training floor overview</Text>

      <View style={styles.stats}>
        <AppCard style={styles.statCard}>
          <Text style={styles.statValue}>{data.activeClients}</Text>
          <Text style={styles.statLabel}>Active clients</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <Text style={styles.statValue}>{data.upcomingBookings}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </AppCard>
      </View>

      <SectionHeader
        title="Today"
        actionLabel="Calendar"
        onActionPress={() => router.push('/(coach)/calendar')}
      />
      <AppCard accent>
        {data.todaySessions.length === 0 ? (
          <EmptyState title="No sessions today" />
        ) : (
          data.todaySessions.map((s) => (
            <View key={s.bookingId} style={styles.coachSessionRow}>
              <Text style={styles.coachSessionTime}>{s.time}</Text>
              <Text style={styles.coachSessionName}>{s.clientName}</Text>
              <Text style={styles.coachSessionStatus}>{s.status}</Text>
            </View>
          ))
        )}
      </AppCard>

      <SectionHeader
        title="Class chats"
        actionLabel="Open"
        onActionPress={() => router.push('/(coach)/messages')}
      />
      <AppCard accent onPress={() => router.push('/(coach)/messages')} style={styles.card}>
        <Text style={styles.cardTitle}>Afternoon groups</Text>
        <Text style={styles.cardMeta}>Message 5:30 and 6:30 class chats</Text>
      </AppCard>

      <SectionHeader title="Recently completed workouts" />
      {data.recentWorkouts.length === 0 ? (
        <EmptyState title="No recent workouts" />
      ) : (
        data.recentWorkouts.map((w, idx) => (
          <AppCard key={`${w.memberName}-${idx}`} style={styles.card}>
            <Text style={styles.cardTitle}>{w.memberName}</Text>
            <Text style={styles.cardMeta}>
              {w.workoutName} · {w.finishedAt}
            </Text>
          </AppCard>
        ))
      )}

      <SectionHeader title="Clients requiring attention" />
      {data.attentionClients.map((c) => (
        <AppCard
          key={c.memberId}
          onPress={() => router.push(`/(coach)/clients/${c.memberId}`)}
          style={styles.card}>
          <Text style={styles.cardTitle}>{c.name}</Text>
          <Text style={styles.attention}>{c.reason}</Text>
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  badge: {
    ...typography.label,
    color: colors.accent,
  },
  title: {
    ...typography.hero,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.9,
  },
  hero: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: '#101410',
  },
  heroTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  heroIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarWrap: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    padding: 2,
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  heroInner: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  heroWelcomeBlock: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  heroKicker: {
    ...typography.sectionKicker,
    marginBottom: spacing.xs,
  },
  heroWelcomeLine: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  heroBrand: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 64,
    lineHeight: 62,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: -4,
  },
  heroRule: {
    width: 56,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    marginVertical: spacing.xs,
  },
  heroPersonal: {
    marginTop: spacing.xs,
  },
  heroPersonalLead: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  heroPersonalName: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.accent,
    letterSpacing: 1.4,
  },
  heroVenuePill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.16)',
    backgroundColor: 'rgba(200,255,0,0.05)',
  },
  heroVenue: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
    letterSpacing: 1.4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kpiCard: {
    position: 'relative',
    overflow: 'hidden',
    width: '48%',
    flexGrow: 1,
    minWidth: 148,
    minHeight: 108,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 6,
    justifyContent: 'flex-end',
  },
  kpiCardFeatured: {
    backgroundColor: '#121812',
  },
  kpiGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  kpiIconWrap: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  kpiIconWrapFeatured: {
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  kpiValue: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: 1,
  },
  kpiValueFeatured: {
    color: colors.accent,
  },
  kpiLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  hoursStrip: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.lg,
  },
  hoursStripPressed: {
    opacity: 0.92,
  },
  hoursGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  hoursIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  hoursCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  hoursKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 1.8,
  },
  hoursMeta: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
    letterSpacing: 1.6,
  },
  hoursChevron: {
    fontFamily: fonts.sans,
    fontSize: 22,
    color: colors.textMuted,
    marginLeft: 2,
  },
  weekDots: {
    flexDirection: 'row',
    gap: 3,
    flexShrink: 0,
  },
  weekDot: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  weekDotOn: {
    backgroundColor: colors.accent,
  },
  weekDotText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 8,
    color: colors.textMuted,
  },
  weekDotTextOn: {
    color: '#0A0A0A',
  },
  sectionEyebrow: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionCopy: { flex: 1, gap: 2, minWidth: 0 },
  sectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 2.4,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  sectionSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 4,
  },
  sectionActionText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionTile: {
    position: 'relative',
    overflow: 'hidden',
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
    maxWidth: '48%',
    minWidth: 0,
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  actionTileAccent: {
    backgroundColor: '#121812',
  },
  actionTilePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  actionTileGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  actionAccentRail: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 3,
    borderTopRightRadius: radius.full,
    borderBottomRightRadius: radius.full,
    backgroundColor: colors.accent,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginLeft: 4,
    flexShrink: 0,
  },
  actionIconWrapAccent: {
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  actionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  actionTitle: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 18,
    lineHeight: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  actionTitleAccent: {
    color: colors.accent,
  },
  actionMeta: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
  },
  actionArrow: {
    fontFamily: fonts.sans,
    fontSize: 20,
    lineHeight: 20,
    color: colors.textMuted,
    marginRight: 2,
    flexShrink: 0,
  },
  actionArrowAccent: {
    color: 'rgba(200,255,0,0.55)',
  },
  panel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sessionsEmpty: {
    marginBottom: spacing.lg,
  },
  sessionsList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sessionCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionCardOk: {
    backgroundColor: '#101410',
    borderColor: 'rgba(200,255,0,0.18)',
  },
  sessionCardWarn: {
    backgroundColor: '#141210',
    borderColor: 'rgba(250,204,21,0.2)',
  },
  sessionCardPressed: {
    opacity: 0.92,
  },
  sessionGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  sessionRail: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 3,
    borderTopRightRadius: radius.full,
    borderBottomRightRadius: radius.full,
    backgroundColor: colors.textMuted,
  },
  sessionRailOk: {
    backgroundColor: colors.accent,
  },
  sessionRailWarn: {
    backgroundColor: '#FACC15',
  },
  sessionRailGroup: {
    backgroundColor: '#60A5FA',
  },
  sessionTimeBlock: {
    width: 58,
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  sessionTime: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 0.5,
    color: colors.text,
  },
  sessionMeridiem: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  sessionAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  sessionAvatarGroup: {
    backgroundColor: 'rgba(96,165,250,0.15)',
  },
  sessionInitials: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accent,
  },
  sessionInitialsGroup: {
    color: '#93C5FD',
  },
  sessionCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  sessionName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  kindPillGroup: {
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderColor: 'rgba(96,165,250,0.28)',
  },
  kindPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  kindPillTextGroup: {
    color: '#93C5FD',
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sessionHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  sessionAside: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  attentionHead: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.22)',
    backgroundColor: '#141210',
  },
  attentionHeadGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  attentionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  attentionHeadIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.28)',
  },
  attentionHeadCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  attentionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: '#FACC15',
  },
  attentionTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  attentionSub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  attentionAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    backgroundColor: 'rgba(250,204,21,0.1)',
  },
  attentionActionText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: '#FACC15',
    letterSpacing: 0.4,
  },
  attentionEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    backgroundColor: 'rgba(74,222,128,0.06)',
  },
  attentionEmptyTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  attentionEmptySub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  attentionList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  attentionCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.28)',
  },
  attentionGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  attentionDaysBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 42,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(250,204,21,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
  },
  attentionDaysValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: '#FACC15',
    letterSpacing: 0.5,
  },
  attentionDaysLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(250,204,21,0.75)',
  },
  attentionAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,204,21,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.28)',
  },
  attentionInitials: {
    fontFamily: fonts.sansSemiBold,
    color: '#FACC15',
    fontSize: 14,
  },
  attentionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  attentionName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  attentionReasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  attentionReason: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  attentionCta: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.4,
    color: '#FACC15',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    gap: spacing.xs,
  },
  statValue: {
    ...typography.title,
    color: colors.accent,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  coachSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  coachSessionTime: {
    ...typography.subtitle,
    color: colors.accent,
    width: 72,
    fontSize: 15,
  },
  coachSessionName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  coachSessionStatus: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  card: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  attention: {
    ...typography.caption,
    color: colors.danger,
  },
});
