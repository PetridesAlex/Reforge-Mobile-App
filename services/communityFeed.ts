import { useSupabaseCommunity } from '@/lib/community/config';
import * as feedSupabase from '@/services/communityFeed.supabase';
import type {
  CommunityComment,
  CommunityFeedCursor,
  CommunityFeedPage,
  CommunityPost,
  CommunityPostVisibility,
  CommunityProfilePublic,
} from '@/types';

type CreatePostInput = {
  authorId: string;
  body: string;
  visibility?: CommunityPostVisibility;
  localImageUris?: string[];
};

type MockStore = {
  posts: CommunityPost[];
  likes: Set<string>;
  saves: Set<string>;
  comments: CommunityComment[];
  commentLikes: Set<string>;
};

const mock: MockStore = {
  posts: [
    {
      id: 'mock-post-1',
      author_id: 'mock-coach',
      author_name: 'Coach Maria',
      author_username: 'coachmaria',
      author_avatar_url: null,
      author_role: 'coach',
      body: 'Strong week in the gym. Keep the intensity high and the form cleaner than the ego.',
      visibility: 'community',
      post_type: 'status',
      like_count: 12,
      comment_count: 2,
      is_pinned: false,
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      deleted_at: null,
      media: [],
      liked_by_me: false,
      saved_by_me: false,
    },
    {
      id: 'mock-post-2',
      author_id: 'mock-member',
      author_name: 'Andreas',
      author_username: 'andreas',
      author_avatar_url: null,
      author_role: 'member',
      body: 'Push day complete. Finally hit 100kg × 5 on bench today.',
      visibility: 'community',
      post_type: 'status',
      like_count: 42,
      comment_count: 1,
      is_pinned: false,
      created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      deleted_at: null,
      media: [],
      liked_by_me: false,
      saved_by_me: false,
    },
  ],
  likes: new Set(),
  saves: new Set(),
  comments: [
    {
      id: 'mock-c-1',
      post_id: 'mock-post-1',
      author_id: 'mock-member',
      author_name: 'Andreas',
      author_username: 'andreas',
      author_avatar_url: null,
      author_role: 'member',
      parent_comment_id: null,
      body: 'Locked in 👊',
      like_count: 1,
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      deleted_at: null,
      liked_by_me: false,
      replies: [],
    },
  ],
  commentLikes: new Set(),
};

function likeKey(userId: string, postId: string) {
  return `${userId}:${postId}`;
}

export async function listCommunityFeed(
  userId: string,
  cursor?: CommunityFeedCursor | null,
  limit = 15,
): Promise<CommunityFeedPage> {
  if (useSupabaseCommunity()) {
    try {
      return await feedSupabase.listCommunityFeed(userId, cursor, limit);
    } catch {
      /* fall through to mock */
    }
  }
  let rows = [...mock.posts]
    .filter((p) => !p.deleted_at && p.visibility === 'community')
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
  if (cursor) {
    rows = rows.filter(
      (p) =>
        p.created_at < cursor.created_at ||
        (p.created_at === cursor.created_at && p.id < cursor.id),
    );
  }
  const page = rows.slice(0, limit).map((p) => ({
    ...p,
    liked_by_me: mock.likes.has(likeKey(userId, p.id)),
    saved_by_me: mock.saves.has(likeKey(userId, p.id)),
    media: p.media ?? [],
  }));
  const last = page[page.length - 1];
  return {
    posts: page,
    nextCursor: page.length === limit && last ? { created_at: last.created_at, id: last.id } : null,
  };
}

export async function getCommunityPost(postId: string, userId: string): Promise<CommunityPost | null> {
  if (useSupabaseCommunity() && !postId.startsWith('mock-')) {
    return feedSupabase.getCommunityPost(postId, userId);
  }
  const p = mock.posts.find((x) => x.id === postId && !x.deleted_at);
  if (!p) return null;
  return {
    ...p,
    liked_by_me: mock.likes.has(likeKey(userId, p.id)),
    saved_by_me: mock.saves.has(likeKey(userId, p.id)),
  };
}

export async function createCommunityPost(input: CreatePostInput): Promise<CommunityPost> {
  if (useSupabaseCommunity()) {
    return feedSupabase.createCommunityPost(input);
  }
  const now = new Date().toISOString();
  const post: CommunityPost = {
    id: `mock-post-${Date.now()}`,
    author_id: input.authorId,
    author_name: 'You',
    author_username: null,
    author_avatar_url: null,
    author_role: 'member',
    body: input.body.trim(),
    visibility: input.visibility ?? 'community',
    post_type: (input.localImageUris?.length ?? 0) > 0 ? 'media' : 'status',
    like_count: 0,
    comment_count: 0,
    is_pinned: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    media: (input.localImageUris ?? []).map((uri, i) => ({
      id: `mock-media-${Date.now()}-${i}`,
      post_id: `mock-post-${Date.now()}`,
      storage_path: uri,
      public_url: uri,
      media_type: 'image' as const,
      width: null,
      height: null,
      duration_seconds: null,
      sort_order: i,
      created_at: now,
    })),
    liked_by_me: false,
    saved_by_me: false,
  };
  mock.posts = [post, ...mock.posts];
  return post;
}

export async function softDeleteCommunityPost(
  postId: string,
  userId: string,
  opts?: { asModerator?: boolean },
): Promise<void> {
  if (useSupabaseCommunity() && !postId.startsWith('mock-')) {
    return feedSupabase.softDeleteCommunityPost(postId, userId, opts);
  }
  mock.posts = mock.posts.map((p) =>
    p.id === postId && (opts?.asModerator || p.author_id === userId)
      ? { ...p, deleted_at: new Date().toISOString() }
      : p,
  );
}

export async function updateCommunityPostBody(
  postId: string,
  userId: string,
  body: string,
): Promise<CommunityPost> {
  if (useSupabaseCommunity() && !postId.startsWith('mock-')) {
    return feedSupabase.updateCommunityPostBody(postId, userId, body);
  }
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Caption cannot be empty');
  const idx = mock.posts.findIndex((p) => p.id === postId && p.author_id === userId && !p.deleted_at);
  if (idx < 0) throw new Error('Post not found');
  mock.posts[idx] = {
    ...mock.posts[idx],
    body: trimmed,
    updated_at: new Date().toISOString(),
  };
  return {
    ...mock.posts[idx],
    liked_by_me: mock.likes.has(likeKey(userId, postId)),
    saved_by_me: mock.saves.has(likeKey(userId, postId)),
  };
}

export async function togglePostLike(
  postId: string,
  userId: string,
): Promise<{ liked: boolean; like_count: number }> {
  if (useSupabaseCommunity() && !postId.startsWith('mock-')) {
    return feedSupabase.togglePostLike(postId, userId);
  }
  const key = likeKey(userId, postId);
  const post = mock.posts.find((p) => p.id === postId);
  if (!post) throw new Error('Post not found');
  if (mock.likes.has(key)) {
    mock.likes.delete(key);
    post.like_count = Math.max(0, post.like_count - 1);
    return { liked: false, like_count: post.like_count };
  }
  mock.likes.add(key);
  post.like_count += 1;
  return { liked: true, like_count: post.like_count };
}

export async function toggleSavePost(
  postId: string,
  userId: string,
): Promise<{ saved: boolean }> {
  if (useSupabaseCommunity() && !postId.startsWith('mock-')) {
    return feedSupabase.toggleSavePost(postId, userId);
  }
  const key = likeKey(userId, postId);
  if (mock.saves.has(key)) {
    mock.saves.delete(key);
    return { saved: false };
  }
  mock.saves.add(key);
  return { saved: true };
}

export async function listSavedPosts(userId: string): Promise<CommunityPost[]> {
  if (useSupabaseCommunity()) {
    try {
      return await feedSupabase.listSavedPosts(userId);
    } catch {
      /* fall through */
    }
  }
  return mock.posts
    .filter((p) => mock.saves.has(likeKey(userId, p.id)) && !p.deleted_at)
    .map((p) => ({
      ...p,
      liked_by_me: mock.likes.has(likeKey(userId, p.id)),
      saved_by_me: true,
    }));
}

export async function listComments(postId: string, userId: string): Promise<CommunityComment[]> {
  if (useSupabaseCommunity() && !postId.startsWith('mock-')) {
    return feedSupabase.listComments(postId, userId);
  }
  const all = mock.comments.filter((c) => c.post_id === postId && !c.deleted_at);
  const tops = all.filter((c) => !c.parent_comment_id);
  return tops.map((c) => ({
    ...c,
    liked_by_me: mock.commentLikes.has(likeKey(userId, c.id)),
    replies: all
      .filter((r) => r.parent_comment_id === c.id)
      .map((r) => ({
        ...r,
        liked_by_me: mock.commentLikes.has(likeKey(userId, r.id)),
      })),
  }));
}

export async function addComment(input: {
  postId: string;
  authorId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<CommunityComment> {
  if (useSupabaseCommunity() && !input.postId.startsWith('mock-')) {
    return feedSupabase.addComment(input);
  }
  const now = new Date().toISOString();
  const comment: CommunityComment = {
    id: `mock-c-${Date.now()}`,
    post_id: input.postId,
    author_id: input.authorId,
    author_name: 'You',
    author_username: null,
    author_avatar_url: null,
    author_role: 'member',
    parent_comment_id: input.parentCommentId ?? null,
    body: input.body.trim(),
    like_count: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    liked_by_me: false,
    replies: [],
  };
  mock.comments.push(comment);
  const post = mock.posts.find((p) => p.id === input.postId);
  if (post) post.comment_count += 1;
  return comment;
}

export async function softDeleteComment(
  commentId: string,
  userId: string,
  opts?: { asModerator?: boolean },
): Promise<void> {
  if (useSupabaseCommunity() && !commentId.startsWith('mock-')) {
    return feedSupabase.softDeleteComment(commentId, userId, opts);
  }
  mock.comments = mock.comments.map((c) =>
    c.id === commentId && (opts?.asModerator || c.author_id === userId)
      ? { ...c, deleted_at: new Date().toISOString() }
      : c,
  );
}

export async function setCommunityPostPinned(postId: string, pinned: boolean): Promise<void> {
  if (useSupabaseCommunity() && !postId.startsWith('mock-')) {
    return feedSupabase.setCommunityPostPinned(postId, pinned);
  }
  mock.posts = mock.posts.map((p) => (p.id === postId ? { ...p, is_pinned: pinned } : p));
}

export async function setCommunityPostVisibility(
  postId: string,
  visibility: CommunityPostVisibility,
): Promise<void> {
  if (useSupabaseCommunity() && !postId.startsWith('mock-')) {
    return feedSupabase.setCommunityPostVisibility(postId, visibility);
  }
  mock.posts = mock.posts.map((p) => (p.id === postId ? { ...p, visibility } : p));
}

export async function listCommunityFeedForModeration(
  userId: string,
  cursor?: CommunityFeedCursor | null,
  limit = 20,
): Promise<CommunityFeedPage> {
  if (useSupabaseCommunity()) {
    try {
      return await feedSupabase.listCommunityFeedForModeration(userId, cursor, limit);
    } catch {
      /* fall through */
    }
  }
  let rows = [...mock.posts]
    .filter((p) => !p.deleted_at)
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
  if (cursor) {
    rows = rows.filter(
      (p) =>
        p.created_at < cursor.created_at ||
        (p.created_at === cursor.created_at && p.id < cursor.id),
    );
  }
  const page = rows.slice(0, limit).map((p) => ({
    ...p,
    liked_by_me: mock.likes.has(likeKey(userId, p.id)),
    saved_by_me: mock.saves.has(likeKey(userId, p.id)),
    media: p.media ?? [],
  }));
  const last = page[page.length - 1];
  return {
    posts: page,
    nextCursor: page.length === limit && last ? { created_at: last.created_at, id: last.id } : null,
  };
}

export async function listAuthorPosts(authorId: string, viewerId: string): Promise<CommunityPost[]> {
  if (useSupabaseCommunity() && !authorId.startsWith('mock-')) {
    return feedSupabase.listAuthorPosts(authorId, viewerId);
  }
  return mock.posts
    .filter((p) => p.author_id === authorId && !p.deleted_at)
    .map((p) => ({
      ...p,
      liked_by_me: mock.likes.has(likeKey(viewerId, p.id)),
      saved_by_me: mock.saves.has(likeKey(viewerId, p.id)),
    }));
}

export async function getCommunityProfile(userId: string): Promise<CommunityProfilePublic | null> {
  if (useSupabaseCommunity() && !userId.startsWith('mock-')) {
    return feedSupabase.getCommunityProfile(userId);
  }
  if (userId === 'mock-coach') {
    return {
      id: userId,
      full_name: 'Coach Maria',
      username: 'coachmaria',
      avatar_url: null,
      role: 'coach',
      community_bio: 'Strength · Conditioning',
      created_at: new Date().toISOString(),
    };
  }
  return {
    id: userId,
    full_name: 'Andreas',
    username: 'andreas',
    avatar_url: null,
    role: 'member',
    community_bio: null,
    created_at: new Date().toISOString(),
  };
}

export async function claimUsername(userId: string, username: string): Promise<void> {
  if (useSupabaseCommunity()) {
    return feedSupabase.claimUsername(userId, username);
  }
}

export async function enableCommunityNotifications(userId: string): Promise<void> {
  if (useSupabaseCommunity()) {
    return feedSupabase.enableCommunityNotifications(userId);
  }
}
