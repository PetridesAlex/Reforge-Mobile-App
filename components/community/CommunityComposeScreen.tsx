import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { BackButton } from '@/components/ui/BackButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import {
  COMMUNITY_MOODS,
  type CommunityMood,
  type CommunityMoodId,
} from '@/lib/community/moods';
import { communityPathsFor, type CommunitySurface } from '@/lib/community/paths';
import * as feed from '@/services/communityFeed';
import { colors, fonts, spacing } from '@/constants/theme';

const MAX_IMAGES = 6;
const CAPTION_MAX = 2200;

type MoodId = CommunityMoodId;
type Mood = CommunityMood;

const MOODS = COMMUNITY_MOODS;

const QUICK_TAGS = [
  { id: 'locked', label: 'Locked in 🔒' },
  { id: 'pr', label: 'New PR 💪' },
  { id: 'grind', label: 'Quiet grind' },
  { id: 'form', label: 'Form over ego' },
  { id: 'recovery', label: 'Recovery day' },
  { id: 'grateful', label: 'Grateful for this work' },
] as const;

const AI_NUDGES = [
  'Write what you’re feeling after today…',
  'One honest line about this session…',
  'If your future self saw this post…',
  'Keep it short, sharp, and real…',
] as const;

type Props = { surface: CommunitySurface };

function pickSpark(mood: Mood, avoid?: string) {
  const options = mood.sparks.filter((s) => s !== avoid);
  const pool = options.length ? options : mood.sparks;
  return pool[Math.floor(Math.random() * pool.length)] ?? mood.sparks[0];
}

export function CommunityComposeScreen({ surface }: Props) {
  const paths = communityPathsFor(surface);
  const { edit: editParam } = useLocalSearchParams<{ edit?: string }>();
  const editId = typeof editParam === 'string' ? editParam : editParam?.[0];
  const isEditing = Boolean(editId);

  const { profile, refreshProfile } = useAuth();
  const userId = profile?.id ?? '';
  const firstName = (profile?.full_name ?? 'athlete').split(' ')[0];

  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [existingMedia, setExistingMedia] = useState<{ id: string; uri: string }[]>([]);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [needsUsername] = useState(!profile?.username);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);
  const [error, setError] = useState<string | null>(null);
  const [captionFocused, setCaptionFocused] = useState(false);
  const [moodId, setMoodId] = useState<MoodId | null>(null);
  const [sparkPreview, setSparkPreview] = useState<string | null>(null);
  const [nudgeIndex, setNudgeIndex] = useState(0);

  const mood = useMemo(() => MOODS.find((m) => m.id === moodId) ?? null, [moodId]);

  const captionPlaceholder = useMemo(() => {
    if (mood) return mood.prompt;
    return AI_NUDGES[nudgeIndex % AI_NUDGES.length];
  }, [mood, nudgeIndex]);

  useEffect(() => {
    if (body.trim() || moodId) return;
    const t = setInterval(() => setNudgeIndex((i) => i + 1), 4200);
    return () => clearInterval(t);
  }, [body, moodId]);

  useEffect(() => {
    if (!editId || !userId) {
      setLoadingEdit(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const post = await feed.getCommunityPost(editId, userId);
        if (!active) return;
        if (!post || String(post.author_id) !== String(userId)) {
          setError('You can only edit your own posts');
          return;
        }
        setBody(post.body ?? '');
        setExistingMedia(
          (post.media ?? []).map((m) => ({
            id: m.id,
            uri: m.public_url ?? m.storage_path,
          })),
        );
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load post');
      } finally {
        if (active) setLoadingEdit(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editId, userId]);

  const buzz = () => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  };

  const pickImages = async () => {
    if (isEditing) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (result.canceled || !result.assets?.length) return;
    setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_IMAGES));
  };

  const applyChip = (label: string) => {
    buzz();
    setBody((prev) => {
      const next = prev.trim() ? `${prev.trim()} ${label}` : label;
      return next.slice(0, CAPTION_MAX);
    });
  };

  const selectMood = (next: Mood) => {
    buzz();
    setMoodId(next.id);
    const spark = pickSpark(next, sparkPreview ?? undefined);
    setSparkPreview(spark);
  };

  const surpriseMe = () => {
    buzz();
    const source = mood ?? MOODS[Math.floor(Math.random() * MOODS.length)];
    if (!mood) setMoodId(source.id);
    const spark = pickSpark(source, sparkPreview ?? undefined);
    setSparkPreview(spark);
  };

  const useSpark = () => {
    if (!sparkPreview) return;
    buzz();
    setBody((prev) => {
      if (!prev.trim()) return sparkPreview.slice(0, CAPTION_MAX);
      return `${prev.trim()}\n${sparkPreview}`.slice(0, CAPTION_MAX);
    });
  };

  const coachLine = useMemo(() => {
    if (isEditing) return 'Tighten the caption — keep the same energy.';
    if (!body.trim() && !mood) {
      return `Hey ${firstName} — what’s the vibe after today? Tap a feeling and I’ll spark a line.`;
    }
    if (mood && !body.trim()) {
      return `${mood.emoji} Nice. ${mood.prompt}`;
    }
    if (body.trim().length < 24) {
      return 'Keep going — one more honest sentence usually hits.';
    }
    if (body.trim().length < 80) {
      return 'This already feels real. Add a photo if you’ve got one.';
    }
    return 'Looks sharp. Ready to share with the floor.';
  }, [body, firstName, isEditing, mood]);

  const publish = async () => {
    if (!userId) return;
    if (!body.trim() && (isEditing ? existingMedia.length === 0 : images.length === 0)) {
      setError('Add a caption or a photo');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEditing && editId) {
        await feed.updateCommunityPostBody(editId, userId, body.trim());
        router.replace(paths.post(editId) as '/(member)/community/post/[id]');
        return;
      }
      if (needsUsername) {
        const handle = username.trim().replace(/^@/, '');
        if (handle.length < 3) {
          setError('Subject must be at least 3 characters (a–z, 0–9, _)');
          setSaving(false);
          return;
        }
        await feed.claimUsername(userId, handle);
        await refreshProfile();
      }
      await feed.createCommunityPost({
        authorId: userId,
        body: body.trim(),
        localImageUris: images,
      });
      router.replace(paths.home as '/(member)/community');
    } catch (e) {
      setError(e instanceof Error ? e.message : isEditing ? 'Could not save' : 'Could not publish');
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) {
    return (
      <Screen>
        <Skeleton height={40} width="40%" style={{ marginTop: spacing.md }} />
        <Skeleton height={160} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.top}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{isEditing ? 'YOUR POST' : 'SHARE THE FLOOR'}</Text>
          <Text style={styles.title}>{isEditing ? 'EDIT' : 'NEW DROP'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!isEditing ? (
          <View style={styles.aiCard}>
            <LinearGradient
              colors={['rgba(200,255,0,0.14)', 'rgba(200,255,0,0.02)', 'transparent']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.aiHeader}>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={12} color={colors.background} />
                <Text style={styles.aiBadgeText}>REFORGE SPARK</Text>
              </View>
              <Pressable onPress={surpriseMe} style={styles.surpriseBtn} hitSlop={6}>
                <Ionicons name="shuffle" size={14} color={colors.accent} />
                <Text style={styles.surpriseText}>SURPRISE ME</Text>
              </Pressable>
            </View>
            <Text style={styles.aiCoach}>{coachLine}</Text>

            <Text style={styles.moodLabel}>HOW ARE YOU FEELING TODAY?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.moodRow}>
              {MOODS.map((m) => {
                const active = moodId === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => selectMood(m)}
                    style={({ pressed }) => [
                      styles.moodChip,
                      active && styles.moodChipActive,
                      pressed && styles.moodChipPressed,
                    ]}>
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text style={[styles.moodChipText, active && styles.moodChipTextActive]}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {sparkPreview ? (
              <View style={styles.sparkBox}>
                <Text style={styles.sparkKicker}>SPARK LINE</Text>
                <Text style={styles.sparkText}>{sparkPreview}</Text>
                <View style={styles.sparkActions}>
                  <Pressable onPress={useSpark} style={styles.sparkUse}>
                    <Ionicons name="arrow-down" size={14} color={colors.background} />
                    <Text style={styles.sparkUseText}>USE THIS</Text>
                  </Pressable>
                  <Pressable onPress={surpriseMe} style={styles.sparkAgain}>
                    <Text style={styles.sparkAgainText}>ANOTHER</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.aiHint}>
                Pick a vibe — or tap Surprise Me — and we’ll draft a caption starter for you.
              </Text>
            )}
          </View>
        ) : null}

        {!isEditing && needsUsername ? (
          <View style={styles.field}>
            <Text style={styles.label}>SUBJECT</Text>
            <Text style={styles.hint}>Your public handle — letters, numbers, _ only</Text>
            <View style={styles.subjectRow}>
              <Text style={styles.at}>@</Text>
              <TextInput
                value={username}
                onChangeText={(t) =>
                  setUsername(
                    t
                      .replace(/^@/, '')
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, '')
                      .slice(0, 24),
                  )
                }
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="yourhandle"
                placeholderTextColor={colors.textMuted}
                style={styles.subjectInput}
                maxLength={24}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.field}>
          <View style={styles.captionHeader}>
            <Text style={styles.label}>YOUR WORDS</Text>
            <Text style={styles.count}>
              {body.length}/{CAPTION_MAX}
            </Text>
          </View>
          <Text style={styles.hint}>
            {mood
              ? `Write it like you’d tell a training partner — ${mood.label.toLowerCase()} energy.`
              : 'Write what you’re feeling today. Short, sharp, real.'}
          </Text>

          <View style={[styles.captionShell, captionFocused && styles.captionShellFocused]}>
            <LinearGradient
              colors={['rgba(200,255,0,0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <TextInput
              value={body}
              onChangeText={(t) => setBody(t.slice(0, CAPTION_MAX))}
              onFocus={() => setCaptionFocused(true)}
              onBlur={() => setCaptionFocused(false)}
              placeholder={captionPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.28)"
              style={styles.captionInput}
              multiline
              maxLength={CAPTION_MAX}
              textAlignVertical="top"
            />
          </View>

          <Text style={styles.tagLabel}>QUICK TAGS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {QUICK_TAGS.map((chip) => (
              <Pressable
                key={chip.id}
                onPress={() => applyChip(chip.label)}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}>
                <Text style={styles.chipText}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>MEDIA</Text>
          <Text style={styles.hint}>
            {isEditing
              ? 'Photos stay as published. Caption edits save instantly.'
              : `Drop up to ${MAX_IMAGES} photos — make the post feel alive.`}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {isEditing
              ? existingMedia.map((m) => (
                  <View key={m.id} style={styles.thumbWrap}>
                    <Image source={{ uri: m.uri }} style={styles.thumb} />
                  </View>
                ))
              : images.map((uri) => (
                  <View key={uri} style={styles.thumbWrap}>
                    <Image source={{ uri }} style={styles.thumb} />
                    <Pressable
                      onPress={() => setImages((prev) => prev.filter((u) => u !== uri))}
                      style={styles.remove}>
                      <Ionicons name="close" size={14} color={colors.text} />
                    </Pressable>
                  </View>
                ))}
            {!isEditing && images.length < MAX_IMAGES ? (
              <Pressable onPress={() => void pickImages()} style={styles.addMedia}>
                <Ionicons name="image-outline" size={22} color={colors.accent} />
                <Text style={styles.addMediaText}>PHOTO</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          title={
            saving
              ? isEditing
                ? 'SAVING…'
                : 'SHARING…'
              : isEditing
                ? 'SAVE'
                : 'SHARE WITH THE FLOOR'
          }
          onPress={() => void publish()}
          disabled={saving || (!isEditing && needsUsername && !username.trim())}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    color: colors.text,
  },
  content: { gap: spacing.lg, paddingBottom: spacing.xxl },
  aiCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: 12,
    overflow: 'hidden',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  aiBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.background,
  },
  surpriseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  surpriseText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  aiCoach: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.88)',
  },
  moodLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  moodRow: {
    gap: 8,
    paddingBottom: 2,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  moodChipActive: {
    borderColor: 'rgba(200,255,0,0.55)',
    backgroundColor: 'rgba(200,255,0,0.14)',
  },
  moodChipPressed: {
    opacity: 0.9,
  },
  moodEmoji: {
    fontSize: 14,
  },
  moodChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  moodChipTextActive: {
    color: colors.text,
  },
  sparkBox: {
    gap: 8,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sparkKicker: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  sparkText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  sparkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  sparkUse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  sparkUseText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.background,
  },
  sparkAgain: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  sparkAgainText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },
  aiHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  field: { gap: 8 },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: -2,
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.surface,
    borderRadius: 4,
    paddingHorizontal: 12,
  },
  at: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.accent,
    marginRight: 4,
  },
  subjectInput: {
    flex: 1,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  captionShell: {
    minHeight: 168,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(20,20,20,0.95)',
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  captionShellFocused: {
    borderColor: 'rgba(200,255,0,0.45)',
    shadowColor: colors.accent,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  captionInput: {
    minHeight: 140,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0.15,
  },
  tagLabel: {
    marginTop: 4,
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textMuted,
  },
  chips: {
    gap: 8,
    paddingTop: 2,
    paddingBottom: 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipPressed: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  thumbs: { gap: 10, alignItems: 'center', paddingTop: 2 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 96, height: 96, borderRadius: 6 },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  addMedia: {
    width: 96,
    height: 96,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(200,255,0,0.04)',
  },
  addMediaText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: '#FF6B6B',
  },
});
