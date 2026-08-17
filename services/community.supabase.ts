import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { canManageAllChats, isCoachOrAdmin } from '@/lib/permissions';
import * as adminSupabase from '@/services/admin.supabase';
import type {
  AppNotification,
  AppNotificationType,
  ChatMessage,
  ChatMessageType,
  ChatThread,
  ChatThreadKind,
  ChatThreadPreview,
  Profile,
  UserRole,
} from '@/types';

type ThreadRow = {
  id: string;
  name: string;
  coach_id: string;
  description: string | null;
  kind: ChatThreadKind;
  class_id: string | null;
  created_at: string;
};

async function fetchProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map();
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
  if (error) throw new Error(formatSupabaseError(error));
  return new Map((data ?? []).map((row) => [row.id as string, row as Profile]));
}

async function fetchThreadMembers(threadIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (threadIds.length === 0) return map;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_thread_members')
    .select('thread_id, member_id')
    .in('thread_id', threadIds);
  if (error) throw new Error(formatSupabaseError(error));
  for (const row of data ?? []) {
    const threadId = row.thread_id as string;
    const memberId = row.member_id as string;
    const list = map.get(threadId) ?? [];
    list.push(memberId);
    map.set(threadId, list);
  }
  return map;
}

function mapThread(row: ThreadRow, memberIds: string[]): ChatThread {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    coach_id: row.coach_id,
    description: row.description,
    member_ids: memberIds,
    class_id: row.class_id,
    created_at: row.created_at,
  };
}

function displayThreadTitle(
  thread: ChatThread,
  viewerId: string,
  role: UserRole | null | undefined,
  names: Map<string, Profile>,
) {
  if (thread.kind === 'coach_dm') {
    if (role === 'member') {
      return names.get(thread.coach_id)?.full_name ?? 'Your coach';
    }
    const athleteId = thread.member_ids.find((id) => id !== thread.coach_id) ?? thread.member_ids[0];
    return names.get(athleteId ?? '')?.full_name ?? 'Athlete';
  }
  if (thread.kind === 'private') {
    const peerId = thread.member_ids.find((id) => id !== viewerId);
    if (peerId) return names.get(peerId)?.full_name ?? thread.name;
  }
  return thread.name;
}

async function coachIdForMember(memberId: string): Promise<string | null> {
  const supabase = getSupabase();

  const { data: link } = await supabase
    .from('coach_clients')
    .select('coach_id')
    .eq('member_id', memberId)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (link?.coach_id) return link.coach_id as string;

  try {
    const { data: assignment } = await supabase
      .from('client_programs')
      .select('program_id, programs(coach_id)')
      .eq('client_id', memberId)
      .eq('is_active', true)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    const program = assignment?.programs as { coach_id?: string } | { coach_id?: string }[] | null;
    const coachFromProgram = Array.isArray(program) ? program[0]?.coach_id : program?.coach_id;
    if (coachFromProgram) return coachFromProgram;
  } catch {
    // optional
  }

  try {
    const coaches = await adminSupabase.listCoaches();
    return coaches[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function ensureCoachDmThread(memberId: string): Promise<{ thread: ChatThread; created: boolean }> {
  const supabase = getSupabase();
  const existingThreads = await loadAccessibleThreads(memberId, 'member').catch(() => [] as ChatThread[]);
  const existingDm = existingThreads.find((t) => t.kind === 'coach_dm' && t.member_ids.includes(memberId));

  // Preferred path: security-definer RPC (creates coach link + thread under RLS)
  const { data: rpcRow, error: rpcError } = await supabase.rpc('get_or_create_coach_dm', {
    p_member_id: memberId,
  });

  if (!rpcError && rpcRow) {
    const row = (Array.isArray(rpcRow) ? rpcRow[0] : rpcRow) as ThreadRow;
    const membersByThread = await fetchThreadMembers([row.id]);
    const thread = mapThread(row, membersByThread.get(row.id) ?? [memberId]);
    return { thread, created: !existingDm || existingDm.id !== thread.id };
  }

  // Fallback for DBs that have not applied migration 021 yet
  if (existingDm) return { thread: existingDm, created: false };

  const coach_id = await coachIdForMember(memberId);
  const coaches = await adminSupabase.listCoaches().catch(() => [] as Profile[]);
  const resolvedCoachId = coach_id ?? coaches[0]?.id;
  if (!resolvedCoachId) {
    throw new Error(
      rpcError
        ? `No coach available. Run migration 021_coach_dm_ensure.sql (${formatSupabaseError(rpcError)})`
        : 'No coach available in this studio yet',
    );
  }

  const coachProfile = (await fetchProfilesByIds([resolvedCoachId])).get(resolvedCoachId);
  const { data: inserted, error } = await supabase
    .from('chat_threads')
    .insert({
      name: coachProfile?.full_name ?? 'Your coach',
      coach_id: resolvedCoachId,
      description: 'Direct line to your coach — training, nutrition, scheduling',
      kind: 'coach_dm',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `Could not open coach chat. Apply migration 021_coach_dm_ensure.sql in Supabase. (${formatSupabaseError(error)})`,
    );
  }

  const thread = mapThread(inserted as ThreadRow, [memberId]);
  await supabase.from('chat_thread_members').insert({ thread_id: thread.id, member_id: memberId });

  await supabase.from('chat_messages').insert({
    thread_id: thread.id,
    sender_id: resolvedCoachId,
    type: 'text',
    body: 'Hey! Message me anytime about training, nutrition, or scheduling.',
  });

  return { thread, created: true };
}

async function loadAccessibleThreads(userId: string, role?: UserRole | null): Promise<ChatThread[]> {
  const supabase = getSupabase();

  const { data: threadRows, error } = await supabase
    .from('chat_threads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(formatSupabaseError(error));

  const ids = (threadRows ?? []).map((r) => r.id as string);
  const membersByThread = await fetchThreadMembers(ids);

  const threads = (threadRows ?? []).map((row) =>
    mapThread(row as ThreadRow, membersByThread.get(row.id as string) ?? []),
  );

  return threads.filter((thread) => {
    if (canManageAllChats(role)) return true;
    if (thread.coach_id === userId) return true;
    if (thread.member_ids.includes(userId)) return true;
    return false;
  });
}

async function unreadCount(threadId: string, viewerId: string): Promise<number> {
  const supabase = getSupabase();
  const [{ data: cursor }, { data: messages }] = await Promise.all([
    supabase
      .from('chat_read_cursors')
      .select('last_read_at')
      .eq('user_id', viewerId)
      .eq('thread_id', threadId)
      .maybeSingle(),
    supabase
      .from('chat_messages')
      .select('id, sender_id, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const lastRead = cursor?.last_read_at as string | undefined;
  return (messages ?? []).filter(
    (m) => m.sender_id !== viewerId && (!lastRead || (m.created_at as string) > lastRead),
  ).length;
}

async function enrichPreview(
  thread: ChatThread,
  viewerId: string,
  role?: UserRole | null,
): Promise<ChatThreadPreview> {
  const supabase = getSupabase();
  const nameIds = [...new Set([thread.coach_id, ...thread.member_ids, viewerId])];
  const names = await fetchProfilesByIds(nameIds);

  const { data: latest } = await supabase
    .from('chat_messages')
    .select('body, created_at')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const unread = await unreadCount(thread.id, viewerId);

  return {
    ...thread,
    name: displayThreadTitle(thread, viewerId, role, names),
    last_message: (latest?.body as string) ?? null,
    last_message_at: (latest?.created_at as string) ?? thread.created_at,
    unread_count: unread,
  };
}

async function pushNotification(input: {
  userId: string;
  title: string;
  body: string;
  threadId: string;
  type: AppNotificationType;
}) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('push_chat_notification', {
    p_user_id: input.userId,
    p_title: input.title,
    p_body: input.body,
    p_thread_id: input.threadId,
    p_type: input.type,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function getThreadPreviews(
  userId: string,
  role?: UserRole | null,
): Promise<ChatThreadPreview[]> {
  if (role === 'member') {
    await ensureCoachDmThread(userId).catch(() => undefined);
  }
  const threads = await loadAccessibleThreads(userId, role);
  const previews = await Promise.all(threads.map((t) => enrichPreview(t, userId, role)));
  return previews.sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
}

export async function getCoachMessageRoster(
  _coachId: string,
  _role?: UserRole | null,
): Promise<Profile[]> {
  const rows = await adminSupabase.listMembers();
  return rows
    .filter((row) => row.active)
    .map((row) => row.member)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/** Studio-wide active members for community People tab (excludes inactive roster). */
export async function listStudioCommunityMembers(viewerId: string): Promise<Profile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'member')
    .order('full_name', { ascending: true })
    .limit(300);
  if (error) throw new Error(formatSupabaseError(error));

  return (data ?? [])
    .map((row) => row as Profile)
    .filter((p) => p.id !== viewerId && p.roster_active !== false);
}

export async function getChatNotifications(userId: string): Promise<AppNotification[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('read', false)
    .in('type', ['chat_request', 'chat_message', 'chat_invite'])
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function markChatNotificationsRead(userId: string, threadId?: string): Promise<void> {
  const supabase = getSupabase();
  let query = supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .in('type', ['chat_request', 'chat_message', 'chat_invite']);

  if (threadId) query = query.eq('thread_id', threadId);
  const { error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
}

export async function markThreadRead(threadId: string, userId: string): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase.from('chat_read_cursors').upsert(
    { user_id: userId, thread_id: threadId, last_read_at: now },
    { onConflict: 'user_id,thread_id' },
  );
  if (error) throw new Error(formatSupabaseError(error));
  await markChatNotificationsRead(userId, threadId);
}

export async function createCoachAthleteChat(
  coachId: string,
  memberId: string,
  role?: UserRole | null,
): Promise<ChatThreadPreview> {
  if (!isCoachOrAdmin(role)) throw new Error('Only coaches can message athletes');
  if (memberId === coachId) throw new Error('Pick an athlete from your roster');

  const supabase = getSupabase();
  const threads = await loadAccessibleThreads(coachId, role);
  let existing = threads.find(
    (t) => t.kind === 'coach_dm' && t.coach_id === coachId && t.member_ids.includes(memberId),
  );

  let created = false;
  if (!existing) {
    const coachProfile = (await fetchProfilesByIds([coachId])).get(coachId);
    const { data: inserted, error } = await supabase
      .from('chat_threads')
      .insert({
        name: (await fetchProfilesByIds([memberId])).get(memberId)?.full_name ?? 'Athlete',
        coach_id: coachId,
        description: 'Direct line to your coach — training, nutrition, scheduling',
        kind: 'coach_dm',
      })
      .select('*')
      .single();
    if (error) throw new Error(formatSupabaseError(error));

    existing = mapThread(inserted as ThreadRow, [memberId]);
    await supabase.from('chat_thread_members').insert({ thread_id: existing.id, member_id: memberId });
    await supabase.from('chat_messages').insert({
      thread_id: existing.id,
      sender_id: coachId,
      type: 'text',
      body: `Hey! ${coachProfile?.full_name ?? 'Your coach'} opened a line for training, nutrition, or scheduling.`,
    });
    created = true;
  }

  if (created) {
    await pushNotification({
      userId: memberId,
      title: `${(await fetchProfilesByIds([coachId])).get(coachId)?.full_name ?? 'Your coach'} opened a chat`,
      body: 'Tap Messages to reply to your coach.',
      threadId: existing!.id,
      type: 'chat_invite',
    });
  }

  return enrichPreview(existing!, coachId, role);
}

export async function createCoachGroupChat(
  coachId: string,
  input: {
    name: string;
    description?: string;
    memberIds: string[];
    welcomeMessage?: string;
  },
  role?: UserRole | null,
): Promise<ChatThreadPreview> {
  if (!isCoachOrAdmin(role)) throw new Error('Only coaches can create groups');

  const name = input.name.trim();
  if (!name) throw new Error('Group name is required');

  const memberIds = [...new Set(input.memberIds.filter((id) => id !== coachId))];
  if (memberIds.length < 1) throw new Error('Pick at least one athlete from your roster');

  const supabase = getSupabase();
  const coachProfile = (await fetchProfilesByIds([coachId])).get(coachId);
  const { data: inserted, error } = await supabase
    .from('chat_threads')
    .insert({
      name,
      coach_id: coachId,
      description: input.description?.trim() || `Coach group · ${coachProfile?.full_name ?? 'Coach'}`,
      kind: 'group',
    })
    .select('*')
    .single();

  if (error) throw new Error(formatSupabaseError(error));

  const thread = mapThread(inserted as ThreadRow, memberIds);
  await supabase.from('chat_thread_members').insert(
    memberIds.map((member_id) => ({ thread_id: thread.id, member_id })),
  );

  const welcome =
    input.welcomeMessage?.trim() ||
    `${coachProfile?.full_name ?? 'Your coach'} created "${name}". Say hi and introduce yourself!`;

  await supabase.from('chat_messages').insert({
    thread_id: thread.id,
    sender_id: coachId,
    type: 'text',
    body: welcome,
  });

  for (const memberId of memberIds) {
    await pushNotification({
      userId: memberId,
      title: `Added to ${name}`,
      body: `${coachProfile?.full_name ?? 'Your coach'} invited you to "${name}". Open Messages to join.`,
      threadId: thread.id,
      type: 'chat_invite',
    });
  }

  return enrichPreview(thread, coachId, role);
}

export async function getOrCreateCoachDm(memberId: string): Promise<ChatThreadPreview> {
  const { thread, created } = await ensureCoachDmThread(memberId);
  if (created) {
    const memberName = (await fetchProfilesByIds([memberId])).get(memberId)?.full_name ?? 'Athlete';
    await pushNotification({
      userId: thread.coach_id,
      title: 'Athlete wants to chat',
      body: `${memberName} opened a one-on-one coach chat.`,
      threadId: thread.id,
      type: 'chat_request',
    }).catch(() => undefined);
  }
  return enrichPreview(thread, memberId, 'member');
}

export async function getClassmates(memberId: string): Promise<Profile[]> {
  const threads = await loadAccessibleThreads(memberId, 'member');
  const peerIds = new Set<string>();
  for (const thread of threads) {
    if (thread.kind !== 'class' || !thread.member_ids.includes(memberId)) continue;
    for (const id of thread.member_ids) {
      if (id !== memberId) peerIds.add(id);
    }
  }
  const profiles = await fetchProfilesByIds([...peerIds]);
  return [...peerIds].map((id) => profiles.get(id)).filter(Boolean) as Profile[];
}

export async function createPrivateChat(
  memberId: string,
  peerMemberId: string,
): Promise<ChatThreadPreview> {
  if (memberId === peerMemberId) throw new Error('Pick someone else to chat with');

  const threads = await loadAccessibleThreads(memberId, 'member');
  const existing = threads.find(
    (t) =>
      t.kind === 'private' &&
      t.member_ids.includes(memberId) &&
      t.member_ids.includes(peerMemberId),
  );
  if (existing) return enrichPreview(existing, memberId, 'member');

  const peer = (await fetchProfilesByIds([peerMemberId])).get(peerMemberId);
  if (!peer) throw new Error('Member not found');

  const coachId = (await coachIdForMember(memberId)) ?? peer.id;
  const supabase = getSupabase();
  const { data: inserted, error } = await supabase
    .from('chat_threads')
    .insert({
      name: peer.full_name,
      coach_id: coachId,
      description: 'Private chat · only visible to you two',
      kind: 'private',
    })
    .select('*')
    .single();

  if (error) throw new Error(formatSupabaseError(error));

  const thread = mapThread(inserted as ThreadRow, [memberId, peerMemberId]);
  await supabase.from('chat_thread_members').insert([
    { thread_id: thread.id, member_id: memberId },
    { thread_id: thread.id, member_id: peerMemberId },
  ]);

  return enrichPreview(thread, memberId, 'member');
}

export async function getThread(threadId: string, viewerId?: string, role?: UserRole | null) {
  const supabase = getSupabase();
  const { data: row, error } = await supabase.from('chat_threads').select('*').eq('id', threadId).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!row) return null;

  const membersByThread = await fetchThreadMembers([threadId]);
  const thread = mapThread(row as ThreadRow, membersByThread.get(threadId) ?? []);

  if (viewerId) {
    const allowed =
      canManageAllChats(role) ||
      thread.coach_id === viewerId ||
      thread.member_ids.includes(viewerId);
    if (!allowed) return null;
    await markThreadRead(threadId, viewerId);
  }

  const memberIds = new Set([...thread.member_ids, thread.coach_id]);
  if (viewerId) memberIds.add(viewerId);
  const profiles = await fetchProfilesByIds([...memberIds]);
  const members = [...memberIds].map((id) => profiles.get(id)).filter(Boolean) as Profile[];

  const displayThread = viewerId
    ? {
        ...thread,
        name: displayThreadTitle(thread, viewerId, role, profiles),
      }
    : thread;

  return { thread: displayThread, members };
}

export async function getMessages(threadId: string): Promise<ChatMessage[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(formatSupabaseError(error));

  const senderIds = [...new Set((data ?? []).map((m) => m.sender_id as string))];
  const profiles = await fetchProfilesByIds(senderIds);

  return (data ?? []).map((m) => ({
    id: m.id as string,
    thread_id: m.thread_id as string,
    sender_id: m.sender_id as string,
    type: m.type as ChatMessageType,
    body: m.body as string,
    meta: (m.meta as ChatMessage['meta']) ?? null,
    created_at: m.created_at as string,
    sender: profiles.get(m.sender_id as string),
  }));
}

export async function sendMessage(input: {
  threadId: string;
  senderId: string;
  body: string;
  type?: ChatMessageType;
  meta?: ChatMessage['meta'];
  role?: UserRole | null;
}): Promise<ChatMessage> {
  const body = input.body.trim();
  if (!body) throw new Error('Message cannot be empty');

  const threadResult = await getThread(input.threadId, input.senderId, input.role);
  if (!threadResult) throw new Error('You do not have access to this chat');

  const { thread } = threadResult;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      thread_id: input.threadId,
      sender_id: input.senderId,
      type: input.type ?? 'text',
      body,
      meta: input.meta ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(formatSupabaseError(error));

  const sender = (await fetchProfilesByIds([input.senderId])).get(input.senderId);
  const message: ChatMessage = {
    id: data.id as string,
    thread_id: data.thread_id as string,
    sender_id: data.sender_id as string,
    type: data.type as ChatMessageType,
    body: data.body as string,
    meta: (data.meta as ChatMessage['meta']) ?? null,
    created_at: data.created_at as string,
    sender,
  };

  const senderName = sender?.full_name ?? 'Someone';
  const preview = body.length > 90 ? `${body.slice(0, 87)}…` : body;
  const recipients = new Set<string>();

  for (const memberId of thread.member_ids) {
    if (memberId !== input.senderId) recipients.add(memberId);
  }
  if (thread.coach_id !== input.senderId) recipients.add(thread.coach_id);

  const isAthleteDm =
    thread.kind === 'coach_dm' &&
    thread.member_ids.includes(input.senderId) &&
    input.senderId !== thread.coach_id;

  // Studio owners should also see athlete DMs even if another coach is assigned.
  if (isAthleteDm) {
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
    for (const row of admins ?? []) {
      if (row.id !== input.senderId) recipients.add(row.id as string);
    }
  }

  for (const userId of recipients) {
    await pushNotification({
      userId,
      title:
        thread.kind === 'group'
          ? `New message · ${thread.name}`
          : isAthleteDm
            ? `Message from ${senderName}`
            : `Message from ${senderName}`,
      body: preview,
      threadId: thread.id,
      type: 'chat_message',
    }).catch(() => undefined);
  }

  return message;
}

export async function getUnreadChatNotifications(userId: string): Promise<number> {
  const rows = await getChatNotifications(userId);
  return rows.length;
}

export async function getChatInviteNotifications(userId: string): Promise<AppNotification[]> {
  const rows = await getChatNotifications(userId);
  return rows.filter((n) => n.type === 'chat_invite');
}
