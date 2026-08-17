import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type {
  CommunityComment,
  CommunityFeedCursor,
  CommunityFeedPage,
  CommunityPost,
  CommunityPostMedia,
  CommunityPostVisibility,
  CommunityProfilePublic,
  UserRole,
} from '@/types';

function mapMedia(row: Record<string, unknown>): CommunityPostMedia {
  return {
    id: row.id as string,
    post_id: row.post_id as string,
    storage_path: row.storage_path as string,
    public_url: (row.public_url as string | null) ?? null,
    media_type: row.media_type as CommunityPostMedia['media_type'],
    width: (row.width as number | null) ?? null,
    height: (row.height as number | null) ?? null,
    duration_seconds: (row.duration_seconds as number | null) ?? null,
    sort_order: row.sort_order as number,
    created_at: row.created_at as string,
  };
}

function mapPost(
  row: Record<string, unknown>,
  opts?: { liked?: boolean; saved?: boolean; media?: CommunityPostMedia[] },
): CommunityPost {
  return {
    id: row.id as string,
    author_id: row.author_id as string,
    author_name: (row.author_name as string) || 'Athlete',
    author_username: (row.author_username as string | null) ?? null,
    author_avatar_url: (row.author_avatar_url as string | null) ?? null,
    author_role: (row.author_role as UserRole) || 'member',
    body: row.body as string,
    visibility: row.visibility as CommunityPostVisibility,
    post_type: row.post_type as CommunityPost['post_type'],
    like_count: (row.like_count as number) ?? 0,
    comment_count: (row.comment_count as number) ?? 0,
    is_pinned: Boolean(row.is_pinned),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
    media: opts?.media ?? [],
    liked_by_me: opts?.liked ?? false,
    saved_by_me: opts?.saved ?? false,
  };
}

function mapComment(row: Record<string, unknown>, liked = false): CommunityComment {
  return {
    id: row.id as string,
    post_id: row.post_id as string,
    author_id: row.author_id as string,
    author_name: (row.author_name as string) || 'Athlete',
    author_username: (row.author_username as string | null) ?? null,
    author_avatar_url: (row.author_avatar_url as string | null) ?? null,
    author_role: (row.author_role as UserRole) || 'member',
    parent_comment_id: (row.parent_comment_id as string | null) ?? null,
    body: row.body as string,
    like_count: (row.like_count as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string | null) ?? null,
    liked_by_me: liked,
    replies: [],
  };
}

async function attachFlagsAndMedia(
  posts: Record<string, unknown>[],
  userId: string,
): Promise<CommunityPost[]> {
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id as string);
  const supabase = getSupabase();
  const [{ data: media }, { data: likes }, { data: saves }] = await Promise.all([
    supabase
      .from('community_post_media')
      .select('*')
      .in('post_id', ids)
      .order('sort_order', { ascending: true }),
    supabase.from('community_post_likes').select('post_id').eq('user_id', userId).in('post_id', ids),
    supabase.from('community_saved_posts').select('post_id').eq('user_id', userId).in('post_id', ids),
  ]);
  const liked = new Set((likes ?? []).map((l) => l.post_id as string));
  const saved = new Set((saves ?? []).map((s) => s.post_id as string));
  const mediaByPost = new Map<string, CommunityPostMedia[]>();
  for (const m of media ?? []) {
    const list = mediaByPost.get(m.post_id as string) ?? [];
    list.push(mapMedia(m as Record<string, unknown>));
    mediaByPost.set(m.post_id as string, list);
  }
  return posts.map((row) =>
    mapPost(row, {
      liked: liked.has(row.id as string),
      saved: saved.has(row.id as string),
      media: mediaByPost.get(row.id as string) ?? [],
    }),
  );
}

export async function listCommunityFeed(
  userId: string,
  cursor?: CommunityFeedCursor | null,
  limit = 15,
): Promise<CommunityFeedPage> {
  const supabase = getSupabase();
  let query = supabase
    .from('community_posts')
    .select('*')
    .is('deleted_at', null)
    .eq('visibility', 'community')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data ?? []) as Record<string, unknown>[];
  const posts = await attachFlagsAndMedia(rows, userId);
  const last = posts[posts.length - 1];
  return {
    posts,
    nextCursor:
      posts.length === limit && last
        ? { created_at: last.created_at, id: last.id }
        : null,
  };
}

export async function getCommunityPost(
  postId: string,
  userId: string,
): Promise<CommunityPost | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) return null;
  const [mapped] = await attachFlagsAndMedia([data as Record<string, unknown>], userId);
  return mapped ?? null;
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

export async function createCommunityPost(input: {
  authorId: string;
  body: string;
  visibility?: CommunityPostVisibility;
  localImageUris?: string[];
  /** Preferred: typed local assets (image + video). Falls back to localImageUris. */
  localMedia?: Array<{ uri: string; mediaType?: 'image' | 'video'; durationSeconds?: number | null }>;
}): Promise<CommunityPost> {
  const supabase = getSupabase();
  const body = input.body.trim();
  const assets: Array<{
    uri: string;
    mediaType?: 'image' | 'video';
    durationSeconds?: number | null;
  }> =
    input.localMedia?.length
      ? input.localMedia
      : (input.localImageUris ?? []).map((uri) => ({ uri, mediaType: 'image' as const }));
  if (!body && !assets.length) {
    throw new Error('Add text, a photo, or a video');
  }

  const { data: post, error } = await supabase
    .from('community_posts')
    .insert({
      author_id: input.authorId,
      body,
      visibility: input.visibility ?? 'community',
      post_type: assets.length > 0 ? 'media' : 'status',
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));

  const mediaRows: CommunityPostMedia[] = [];
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const uri = asset.uri;
    const extRaw = uri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
    const isVideo =
      asset.mediaType === 'video' ||
      ['mp4', 'mov', 'qt', 'm4v'].includes(extRaw);
    const safeExt = isVideo
      ? extRaw === 'mov' || extRaw === 'qt'
        ? 'mov'
        : 'mp4'
      : ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(extRaw)
        ? extRaw
        : 'jpg';
    const path = `${input.authorId}/${post.id}/${Date.now()}-${i}.${safeExt}`;
    const bodyBuf = await uriToArrayBuffer(uri);
    const contentType = isVideo
      ? safeExt === 'mov'
        ? 'video/quicktime'
        : 'video/mp4'
      : safeExt === 'png'
        ? 'image/png'
        : safeExt === 'webp'
          ? 'image/webp'
          : safeExt === 'heic'
            ? 'image/heic'
            : 'image/jpeg';
    const { error: upErr } = await supabase.storage.from('community-media').upload(path, bodyBuf, {
      contentType,
      upsert: false,
    });
    if (upErr) throw new Error(formatSupabaseError(upErr));
    const { data: pub } = supabase.storage.from('community-media').getPublicUrl(path);
    const { data: media, error: mErr } = await supabase
      .from('community_post_media')
      .insert({
        post_id: post.id,
        storage_path: path,
        public_url: pub.publicUrl,
        media_type: isVideo ? 'video' : 'image',
        duration_seconds: isVideo ? (asset.durationSeconds ?? null) : null,
        sort_order: i,
      })
      .select('*')
      .single();
    if (mErr) throw new Error(formatSupabaseError(mErr));
    mediaRows.push(mapMedia(media as Record<string, unknown>));
  }

  await enableCommunityNotifications(input.authorId).catch(() => {
    /* prefs are best-effort — never block a published post */
  });
  return mapPost(post as Record<string, unknown>, { media: mediaRows, liked: false, saved: false });
}

export async function softDeleteCommunityPost(
  postId: string,
  userId: string,
  opts?: { asModerator?: boolean },
): Promise<void> {
  const supabase = getSupabase();

  const { error: rpcError } = await supabase.rpc('soft_delete_community_post', {
    p_post_id: postId,
  });
  if (!rpcError) return;

  const missingRpc =
    /could not find the function|function .* does not exist/i.test(rpcError.message ?? '');
  if (!missingRpc) {
    throw new Error(formatSupabaseError(rpcError));
  }

  // Fallback before migration 034 is applied
  let query = supabase
    .from('community_posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId);
  if (!opts?.asModerator) {
    query = query.eq('author_id', userId);
  }
  const { error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
}

export async function updateCommunityPostBody(
  postId: string,
  userId: string,
  body: string,
): Promise<CommunityPost> {
  const supabase = getSupabase();
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Caption cannot be empty');

  const { data, error } = await supabase
    .from('community_posts')
    .update({ body: trimmed, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('author_id', userId)
    .is('deleted_at', null)
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  const [mapped] = await attachFlagsAndMedia([data as Record<string, unknown>], userId);
  return mapped!;
}

export async function softDeleteComment(
  commentId: string,
  userId: string,
  opts?: { asModerator?: boolean },
): Promise<void> {
  const supabase = getSupabase();
  let query = supabase
    .from('community_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId);
  if (!opts?.asModerator) {
    query = query.eq('author_id', userId);
  }
  const { error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
}

export async function setCommunityPostPinned(postId: string, pinned: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('community_posts')
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function setCommunityPostVisibility(
  postId: string,
  visibility: CommunityPostVisibility,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('community_posts')
    .update({ visibility, updated_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Admin moderation list — includes private posts (RLS: is_admin). */
export async function listCommunityFeedForModeration(
  userId: string,
  cursor?: CommunityFeedCursor | null,
  limit = 20,
): Promise<CommunityFeedPage> {
  const supabase = getSupabase();
  let query = supabase
    .from('community_posts')
    .select('*')
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data ?? []) as Record<string, unknown>[];
  const posts = await attachFlagsAndMedia(rows, userId);
  const last = posts[posts.length - 1];
  return {
    posts,
    nextCursor:
      posts.length === limit && last
        ? { created_at: last.created_at, id: last.id }
        : null,
  };
}

export async function togglePostLike(
  postId: string,
  userId: string,
): Promise<{ liked: boolean; like_count: number }> {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('community_post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('community_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw new Error(formatSupabaseError(error));
  } else {
    const { error } = await supabase
      .from('community_post_likes')
      .insert({ post_id: postId, user_id: userId });
    if (error) throw new Error(formatSupabaseError(error));
  }

  const { data: post } = await supabase
    .from('community_posts')
    .select('like_count')
    .eq('id', postId)
    .single();
  return { liked: !existing, like_count: (post?.like_count as number) ?? 0 };
}

export async function toggleSavePost(
  postId: string,
  userId: string,
): Promise<{ saved: boolean }> {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('community_saved_posts')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from('community_saved_posts')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw new Error(formatSupabaseError(error));
    return { saved: false };
  }
  const { error } = await supabase
    .from('community_saved_posts')
    .insert({ post_id: postId, user_id: userId });
  if (error) throw new Error(formatSupabaseError(error));
  return { saved: true };
}

export async function listSavedPosts(userId: string): Promise<CommunityPost[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('community_saved_posts')
    .select('post_id, created_at, post:community_posts(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data ?? [])
    .map((r) => {
      const post = r.post as unknown;
      if (!post || Array.isArray(post)) return null;
      return post as Record<string, unknown>;
    })
    .filter((p): p is Record<string, unknown> => p != null && !p.deleted_at);
  return attachFlagsAndMedia(rows, userId);
}

export async function listComments(postId: string, userId: string): Promise<CommunityComment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = rows.map((r) => r.id as string);
  const { data: likes } = ids.length
    ? await supabase
        .from('community_comment_likes')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', ids)
    : { data: [] as { comment_id: string }[] };
  const liked = new Set((likes ?? []).map((l) => l.comment_id as string));
  const mapped = rows.map((r) => mapComment(r, liked.has(r.id as string)));
  const tops = mapped.filter((c) => !c.parent_comment_id);
  return tops.map((c) => ({
    ...c,
    replies: mapped.filter((r) => r.parent_comment_id === c.id),
  }));
}

export async function addComment(input: {
  postId: string;
  authorId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<CommunityComment> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('community_comments')
    .insert({
      post_id: input.postId,
      author_id: input.authorId,
      body: input.body.trim(),
      parent_comment_id: input.parentCommentId ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return mapComment(data as Record<string, unknown>, false);
}

export async function listAuthorPosts(
  authorId: string,
  viewerId: string,
): Promise<CommunityPost[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .eq('author_id', authorId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(formatSupabaseError(error));
  return attachFlagsAndMedia((data ?? []) as Record<string, unknown>[], viewerId);
}

export async function getCommunityProfile(
  userId: string,
): Promise<CommunityProfilePublic | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_community_profile', { p_user_id: userId });
  if (error) throw new Error(formatSupabaseError(error));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id as string,
    full_name: row.full_name as string,
    username: (row.username as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    role: row.role as CommunityProfilePublic['role'],
    community_bio: (row.community_bio as string | null) ?? null,
    community_mood: (row.community_mood as string | null) ?? null,
    community_mood_updated_at: (row.community_mood_updated_at as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function claimUsername(userId: string, username: string): Promise<void> {
  const supabase = getSupabase();
  const clean = username
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
  if (clean.length < 3) {
    throw new Error('Subject must be 3–24 letters, numbers, or underscores');
  }

  // Prefer RPC — bypasses recursive profiles UPDATE policy WITH CHECK
  const { error: rpcError } = await supabase.rpc('claim_community_username', {
    p_username: clean,
  });
  if (!rpcError) return;

  const missingRpc =
    /could not find the function|function .* does not exist/i.test(rpcError.message ?? '');
  if (!missingRpc) {
    throw new Error(formatSupabaseError(rpcError));
  }

  // Fallback for projects that have not applied 033 yet
  const { error } = await supabase
    .from('profiles')
    .update({ username: clean })
    .eq('id', userId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function enableCommunityNotifications(userId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('notification_preferences').upsert(
    { user_id: userId, community: true },
    { onConflict: 'user_id' },
  );
  if (error) {
    // Prefs table may already have row — try update only
    await supabase
      .from('notification_preferences')
      .update({ community: true })
      .eq('user_id', userId);
  }
}
