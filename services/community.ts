import { useSupabaseAdmin } from '@/lib/admin/config';
import { useSupabaseCommunity } from '@/lib/community/config';
import { canManageAllChats, isCoachOrAdmin } from '@/lib/permissions';
import * as adminSupabase from '@/services/admin.supabase';
import * as communitySupabase from '@/services/community.supabase';
import {
  delay,
  IDS,
  mockChatMessages,
  mockChatReadCursors,
  mockChatThreads,
  mockClasses,
  mockCoachClients,
  mockEnrollments,
  mockInactiveMemberIds,
  mockNotifications,
  mockProfiles,
  newId,
} from '@/services/mock/data';
import type {
  AppNotification,
  ChatMessage,
  ChatMessageType,
  ChatThread,
  ChatThreadKind,
  ChatThreadPreview,
  Profile,
  UserRole,
} from '@/types';

function canAccessThread(thread: ChatThread, userId: string, role?: UserRole | null) {
  if (thread.kind === 'private') {
    return thread.member_ids.includes(userId);
  }
  if (thread.kind === 'group') {
    if (canManageAllChats(role)) return true;
    if (thread.coach_id === userId) return true;
    return thread.member_ids.includes(userId);
  }
  if (canManageAllChats(role)) return true;
  if (thread.coach_id === userId) return true;
  return thread.member_ids.includes(userId);
}

function coachForMember(memberId: string) {
  return mockCoachClients.find((c) => c.member_id === memberId)?.coach_id ?? IDS.coach;
}

function profileName(userId: string, fallback = 'Member') {
  return mockProfiles.find((p) => p.id === userId)?.full_name ?? fallback;
}

function coachName(coachId: string) {
  return profileName(coachId, 'Your coach');
}

function displayThreadTitle(thread: ChatThread, viewerId: string, role?: UserRole | null) {
  if (thread.kind === 'coach_dm') {
    if (role === 'member') return coachName(thread.coach_id);
    const athleteId = thread.member_ids.find((id) => id !== thread.coach_id) ?? thread.member_ids[0];
    return profileName(athleteId, 'Athlete');
  }
  if (thread.kind === 'private') {
    const peerId = thread.member_ids.find((id) => id !== viewerId);
    if (peerId) return profileName(peerId);
  }
  return thread.name;
}

function staffRecipientIds(thread: ChatThread) {
  const ids = new Set<string>([thread.coach_id]);
  for (const profile of mockProfiles) {
    if (profile.role === 'admin') ids.add(profile.id);
  }
  return [...ids];
}

function pushChatNotification(input: {
  userId: string;
  title: string;
  body: string;
  threadId: string;
  type: AppNotification['type'];
}) {
  const duplicate = mockNotifications.find(
    (n) =>
      !n.read &&
      n.user_id === input.userId &&
      n.thread_id === input.threadId &&
      n.type === input.type &&
      n.title === input.title,
  );
  if (duplicate) return;

  mockNotifications.unshift({
    id: newId('notif'),
    user_id: input.userId,
    title: input.title,
    body: input.body,
    read: false,
    created_at: new Date().toISOString(),
    thread_id: input.threadId,
    type: input.type,
  });
}

function notifyStaffAthleteChat(
  thread: ChatThread,
  memberId: string,
  kind: 'chat_request' | 'chat_message',
  messagePreview?: string,
) {
  const athleteName = profileName(memberId);
  const title =
    kind === 'chat_request' ? 'Athlete wants to chat' : `Message from ${athleteName}`;
  const body =
    kind === 'chat_request'
      ? `${athleteName} opened a one-on-one coach chat.`
      : (messagePreview ?? `${athleteName} sent you a message.`);

  for (const userId of staffRecipientIds(thread)) {
    if (userId === memberId) continue;
    pushChatNotification({
      userId,
      title,
      body,
      threadId: thread.id,
      type: kind,
    });
  }
}

function unreadCountForThread(threadId: string, viewerId: string) {
  const lastRead = mockChatReadCursors[viewerId]?.[threadId];
  return mockChatMessages.filter(
    (m) =>
      m.thread_id === threadId &&
      m.sender_id !== viewerId &&
      (!lastRead || m.created_at > lastRead),
  ).length;
}

function enrichPreview(
  thread: ChatThread,
  viewerId: string,
  role?: UserRole | null,
): ChatThreadPreview {
  const messages = mockChatMessages
    .filter((m) => m.thread_id === thread.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const latest = messages[0];
  return {
    ...thread,
    name: displayThreadTitle(thread, viewerId, role),
    last_message: latest?.body ?? null,
    last_message_at: latest?.created_at ?? thread.created_at,
    unread_count: unreadCountForThread(thread.id, viewerId),
  };
}

function ensureCoachDmThread(memberId: string): { thread: ChatThread; created: boolean } {
  const coachId = coachForMember(memberId);
  const existing = mockChatThreads.find(
    (t) => t.kind === 'coach_dm' && t.coach_id === coachId && t.member_ids.includes(memberId),
  );
  if (existing) return { thread: existing, created: false };

  const thread: ChatThread = {
    id: `thread-coach-dm-${memberId}`,
    kind: 'coach_dm',
    name: coachName(coachId),
    coach_id: coachId,
    description: 'Direct line to your coach — training, nutrition, scheduling',
    member_ids: [memberId],
    created_at: new Date().toISOString(),
  };
  mockChatThreads.push(thread);
  mockChatMessages.push({
    id: newId('msg'),
    thread_id: thread.id,
    sender_id: coachId,
    type: 'text',
    body: 'Hey! Message me anytime about training, nutrition, or scheduling.',
    meta: null,
    created_at: new Date().toISOString(),
  });
  return { thread, created: true };
}

function syncClassThreadMembership(memberId: string) {
  const enrolledClassIds = mockEnrollments
    .filter((e) => e.member_id === memberId)
    .map((e) => e.class_id);

  for (const classId of enrolledClassIds) {
    const thread = mockChatThreads.find((t) => t.kind === 'class' && t.class_id === classId);
    if (thread && !thread.member_ids.includes(memberId)) {
      thread.member_ids.push(memberId);
    }
  }
}

function provisionMemberThreads(memberId: string) {
  ensureCoachDmThread(memberId);
  syncClassThreadMembership(memberId);
}

export async function getThreads(
  userId: string,
  role?: UserRole | null,
): Promise<ChatThread[]> {
  await delay();
  if (role === 'member') provisionMemberThreads(userId);
  return mockChatThreads.filter((t) => canAccessThread(t, userId, role));
}

export async function getThreadPreviews(
  userId: string,
  role?: UserRole | null,
): Promise<ChatThreadPreview[]> {
  if (useSupabaseCommunity()) return communitySupabase.getThreadPreviews(userId, role);
  const threads = await getThreads(userId, role);
  return threads
    .map((thread) => enrichPreview(thread, userId, role))
    .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
}

export async function getUnreadChatNotifications(userId: string): Promise<number> {
  if (useSupabaseCommunity()) return communitySupabase.getUnreadChatNotifications(userId);
  await delay(20);
  return mockNotifications.filter(
    (n) =>
      n.user_id === userId &&
      !n.read &&
      (n.type === 'chat_request' ||
        n.type === 'chat_message' ||
        n.type === 'chat_invite' ||
        n.type === 'booking_created' ||
        n.type === 'booking_confirmed' ||
        n.type === 'booking_cancelled'),
  ).length;
}

export async function getChatInviteNotifications(userId: string): Promise<AppNotification[]> {
  if (useSupabaseCommunity()) return communitySupabase.getChatInviteNotifications(userId);
  await delay(20);
  return mockNotifications
    .filter((n) => n.user_id === userId && !n.read && n.type === 'chat_invite')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getChatNotifications(userId: string): Promise<AppNotification[]> {
  if (useSupabaseCommunity()) return communitySupabase.getChatNotifications(userId);
  await delay(20);
  return mockNotifications
    .filter(
      (n) =>
        n.user_id === userId &&
        !n.read &&
        (n.type === 'chat_request' ||
          n.type === 'chat_message' ||
          n.type === 'chat_invite' ||
          n.type === 'booking_created' ||
          n.type === 'booking_confirmed' ||
          n.type === 'booking_cancelled'),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  if (useSupabaseCommunity()) return communitySupabase.markNotificationRead(userId, notificationId);
  await delay(10);
  const row = mockNotifications.find((n) => n.id === notificationId && n.user_id === userId);
  if (row) row.read = true;
}

export async function markChatNotificationsRead(
  userId: string,
  threadId?: string,
): Promise<void> {
  if (useSupabaseCommunity()) return communitySupabase.markChatNotificationsRead(userId, threadId);
  await delay(20);
  for (const n of mockNotifications) {
    if (n.user_id !== userId) continue;
    if (n.type !== 'chat_request' && n.type !== 'chat_message' && n.type !== 'chat_invite') continue;
    if (threadId && n.thread_id !== threadId) continue;
    n.read = true;
  }
}

export async function markThreadRead(threadId: string, userId: string): Promise<void> {
  if (useSupabaseCommunity()) return communitySupabase.markThreadRead(threadId, userId);
  await delay(20);
  if (!mockChatReadCursors[userId]) mockChatReadCursors[userId] = {};
  mockChatReadCursors[userId][threadId] = new Date().toISOString();
  await markChatNotificationsRead(userId, threadId);
}

export async function getOrCreateCoachDm(memberId: string): Promise<ChatThreadPreview> {
  if (useSupabaseCommunity()) return communitySupabase.getOrCreateCoachDm(memberId);
  await delay(100);
  provisionMemberThreads(memberId);
  const { thread } = ensureCoachDmThread(memberId);
  notifyStaffAthleteChat(thread, memberId, 'chat_request');
  return enrichPreview(thread, memberId, 'member');
}

export async function getClassmates(memberId: string): Promise<Profile[]> {
  if (useSupabaseCommunity()) return communitySupabase.getClassmates(memberId);
  await delay(50);
  provisionMemberThreads(memberId);
  const peerIds = new Set<string>();
  for (const thread of mockChatThreads) {
    if (thread.kind !== 'class' || !thread.member_ids.includes(memberId)) continue;
    for (const id of thread.member_ids) {
      if (id !== memberId) peerIds.add(id);
    }
  }
  return mockProfiles.filter((p) => peerIds.has(p.id));
}

function rosterMemberIdsForCoach(coachId: string, role?: UserRole | null): Set<string> {
  const ids = new Set<string>();
  if (isCoachOrAdmin(role)) {
    for (const profile of mockProfiles) {
      if (profile.role === 'member' && !mockInactiveMemberIds.has(profile.id)) {
        ids.add(profile.id);
      }
    }
    return ids;
  }

  for (const link of mockCoachClients) {
    if (link.coach_id === coachId) ids.add(link.member_id);
  }

  const coachedClassIds = new Set(
    mockClasses.filter((c) => c.coach_id === coachId).map((c) => c.id),
  );
  for (const enrollment of mockEnrollments) {
    if (coachedClassIds.has(enrollment.class_id)) ids.add(enrollment.member_id);
  }

  for (const thread of mockChatThreads) {
    if (thread.coach_id === coachId && thread.kind === 'class') {
      for (const memberId of thread.member_ids) ids.add(memberId);
    }
  }

  return ids;
}

async function getCoachMessageRosterFromSupabase(
  _coachId: string,
  _role?: UserRole | null,
): Promise<Profile[]> {
  const rows = await adminSupabase.listMembers();
  return rows
    .filter((row) => row.active)
    .map((row) => row.member)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function getCoachMessageRoster(
  coachId: string,
  role?: UserRole | null,
): Promise<Profile[]> {
  if (useSupabaseCommunity()) return communitySupabase.getCoachMessageRoster(coachId, role);
  if (useSupabaseAdmin()) {
    return getCoachMessageRosterFromSupabase(coachId, role);
  }

  await delay(50);
  const allowed = rosterMemberIdsForCoach(coachId, role);
  return mockProfiles
    .filter(
      (p) =>
        p.role === 'member' &&
        !mockInactiveMemberIds.has(p.id) &&
        allowed.has(p.id),
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function listStudioCommunityMembers(viewerId: string): Promise<Profile[]> {
  if (useSupabaseCommunity()) return communitySupabase.listStudioCommunityMembers(viewerId);
  await delay(50);
  return mockProfiles
    .filter((p) => p.role === 'member' && p.id !== viewerId && !mockInactiveMemberIds.has(p.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

function notifyThreadParticipants(
  thread: ChatThread,
  senderId: string,
  title: string,
  body: string,
  type: AppNotification['type'] = 'chat_message',
) {
  const recipients = new Set<string>();

  if (thread.kind === 'coach_dm') {
    for (const memberId of thread.member_ids) {
      if (memberId !== senderId) recipients.add(memberId);
    }
    if (thread.coach_id !== senderId) recipients.add(thread.coach_id);
    for (const staffId of staffRecipientIds(thread)) {
      if (staffId !== senderId) recipients.add(staffId);
    }
  } else if (thread.kind === 'group' || thread.kind === 'class') {
    for (const memberId of thread.member_ids) {
      if (memberId !== senderId) recipients.add(memberId);
    }
    if (thread.coach_id !== senderId) recipients.add(thread.coach_id);
  } else if (thread.kind === 'private') {
    for (const memberId of thread.member_ids) {
      if (memberId !== senderId) recipients.add(memberId);
    }
  }

  for (const userId of recipients) {
    pushChatNotification({
      userId,
      title,
      body,
      threadId: thread.id,
      type,
    });
  }
}

function notifyMemberChatInvite(
  thread: ChatThread,
  memberId: string,
  coachId: string,
  kind: 'group' | 'coach_dm',
) {
  const coachLabel = profileName(coachId, 'Your coach');
  pushChatNotification({
    userId: memberId,
    title: kind === 'group' ? `Added to ${thread.name}` : `${coachLabel} opened a chat`,
    body:
      kind === 'group'
        ? `${coachLabel} invited you to "${thread.name}". Open Messages to join the conversation.`
        : `${coachLabel} started a one-on-one chat with you. Tap Messages to reply.`,
    threadId: thread.id,
    type: 'chat_invite',
  });
}

function ensureCoachDmThreadForCoach(
  coachId: string,
  memberId: string,
): { thread: ChatThread; created: boolean } {
  const existing = mockChatThreads.find(
    (t) => t.kind === 'coach_dm' && t.coach_id === coachId && t.member_ids.includes(memberId),
  );
  if (existing) return { thread: existing, created: false };

  const thread: ChatThread = {
    id: `thread-coach-dm-${memberId}`,
    kind: 'coach_dm',
    name: coachName(coachId),
    coach_id: coachId,
    description: 'Direct line to your coach — training, nutrition, scheduling',
    member_ids: [memberId],
    created_at: new Date().toISOString(),
  };
  mockChatThreads.push(thread);
  const coach = mockProfiles.find((p) => p.id === coachId);
  mockChatMessages.push({
    id: newId('msg'),
    thread_id: thread.id,
    sender_id: coachId,
    type: 'text',
    body: `Hey! ${coach?.full_name ?? 'Your coach'} opened a line for training, nutrition, or scheduling.`,
    meta: null,
    created_at: new Date().toISOString(),
  });
  return { thread, created: true };
}

export async function createCoachAthleteChat(
  coachId: string,
  memberId: string,
  role?: UserRole | null,
): Promise<ChatThreadPreview> {
  if (useSupabaseCommunity()) return communitySupabase.createCoachAthleteChat(coachId, memberId, role);
  await delay(150);
  if (!isCoachOrAdmin(role)) throw new Error('Only coaches can message athletes');
  if (memberId === coachId) throw new Error('Pick an athlete from your roster');

  const roster = rosterMemberIdsForCoach(coachId, role);
  if (!roster.has(memberId)) throw new Error('Athlete is not on your roster');

  const { thread, created } = ensureCoachDmThreadForCoach(coachId, memberId);
  if (created) notifyMemberChatInvite(thread, memberId, coachId, 'coach_dm');

  return enrichPreview(thread, coachId, role);
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
  if (useSupabaseCommunity()) return communitySupabase.createCoachGroupChat(coachId, input, role);
  await delay(200);
  if (!isCoachOrAdmin(role)) throw new Error('Only coaches can create groups');

  const name = input.name.trim();
  if (!name) throw new Error('Group name is required');

  const roster = rosterMemberIdsForCoach(coachId, role);
  const memberIds = [...new Set(input.memberIds.filter((id) => id !== coachId && roster.has(id)))];
  if (memberIds.length < 1) throw new Error('Pick at least one athlete from your roster');

  const coach = mockProfiles.find((p) => p.id === coachId);
  const thread: ChatThread = {
    id: newId('thread-group'),
    kind: 'group',
    name,
    coach_id: coachId,
    description: input.description?.trim() || `Coach group · ${coach?.full_name ?? 'Coach'}`,
    member_ids: memberIds,
    created_at: new Date().toISOString(),
  };
  mockChatThreads.push(thread);

  const welcome =
    input.welcomeMessage?.trim() ||
    `${coach?.full_name ?? 'Your coach'} created "${name}". Say hi and introduce yourself!`;

  mockChatMessages.push({
    id: newId('msg'),
    thread_id: thread.id,
    sender_id: coachId,
    type: 'text',
    body: welcome,
    meta: null,
    created_at: new Date().toISOString(),
  });

  for (const memberId of memberIds) {
    notifyMemberChatInvite(thread, memberId, coachId, 'group');
  }

  return enrichPreview(thread, coachId, role);
}

export async function createPrivateChat(
  memberId: string,
  peerMemberId: string,
): Promise<ChatThreadPreview> {
  if (useSupabaseCommunity()) return communitySupabase.createPrivateChat(memberId, peerMemberId);
  await delay(150);
  if (memberId === peerMemberId) throw new Error('Pick someone else to chat with');

  const existing = mockChatThreads.find(
    (t) =>
      t.kind === 'private' &&
      t.member_ids.includes(memberId) &&
      t.member_ids.includes(peerMemberId),
  );
  if (existing) return enrichPreview(existing, memberId, 'member');

  const peer = mockProfiles.find((p) => p.id === peerMemberId);
  if (!peer) throw new Error('Member not found');

  const thread: ChatThread = {
    id: newId('thread-private'),
    kind: 'private',
    name: peer.full_name,
    coach_id: coachForMember(memberId),
    description: 'Private chat · only visible to you two',
    member_ids: [memberId, peerMemberId],
    created_at: new Date().toISOString(),
  };
  mockChatThreads.push(thread);
  return enrichPreview(thread, memberId, 'member');
}

export async function getThread(threadId: string, viewerId?: string, role?: UserRole | null) {
  if (useSupabaseCommunity()) return communitySupabase.getThread(threadId, viewerId, role);
  await delay();
  const thread = mockChatThreads.find((t) => t.id === threadId);
  if (!thread) return null;
  if (viewerId && !canAccessThread(thread, viewerId, role)) return null;

  const memberIds = new Set(thread.member_ids);
  memberIds.add(thread.coach_id);

  const members = mockProfiles.filter((p) => memberIds.has(p.id));

  if (viewerId && canManageAllChats(role) && !members.some((m) => m.id === viewerId)) {
    const admin = mockProfiles.find((p) => p.id === viewerId);
    if (admin) members.unshift(admin);
  }

  const displayThread = viewerId
    ? { ...thread, name: displayThreadTitle(thread, viewerId, role) }
    : thread;

  if (viewerId) {
    await markThreadRead(threadId, viewerId);
  }

  return { thread: displayThread, members };
}

export async function getMessages(threadId: string): Promise<ChatMessage[]> {
  if (useSupabaseCommunity()) return communitySupabase.getMessages(threadId);
  await delay();
  return mockChatMessages
    .filter((m) => m.thread_id === threadId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => ({
      ...m,
      sender: mockProfiles.find((p) => p.id === m.sender_id),
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
  if (useSupabaseCommunity()) return communitySupabase.sendMessage(input);
  await delay(200);
  const thread = mockChatThreads.find((t) => t.id === input.threadId);
  if (!thread) throw new Error('Chat not found');
  if (!canAccessThread(thread, input.senderId, input.role)) {
    throw new Error('You do not have access to this chat');
  }

  const message: ChatMessage = {
    id: newId('msg'),
    thread_id: input.threadId,
    sender_id: input.senderId,
    type: input.type ?? 'text',
    body: input.body.trim(),
    meta: input.meta ?? null,
    created_at: new Date().toISOString(),
    sender: mockProfiles.find((p) => p.id === input.senderId),
  };
  if (!message.body) throw new Error('Message cannot be empty');
  mockChatMessages.push(message);

  if (thread.kind === 'coach_dm' && thread.member_ids.includes(input.senderId)) {
    notifyStaffAthleteChat(thread, input.senderId, 'chat_message', message.body);
  } else {
    const senderName = profileName(input.senderId, 'Someone');
    const preview =
      message.body.length > 90 ? `${message.body.slice(0, 87)}…` : message.body;
    notifyThreadParticipants(
      thread,
      input.senderId,
      thread.kind === 'group' ? `New message · ${thread.name}` : `Message from ${senderName}`,
      preview,
      'chat_message',
    );
  }

  return message;
}

export function threadKindLabel(kind: ChatThreadKind) {
  if (kind === 'coach_dm') return 'Coach';
  if (kind === 'private') return 'Private';
  if (kind === 'group') return 'Group';
  return 'Class group';
}

export function defaultThreadId(memberId?: string) {
  if (!memberId) return 'thread-afternoon-530';
  const match = mockChatThreads.find(
    (t) => t.member_ids.includes(memberId) || t.coach_id === memberId,
  );
  return match?.id ?? 'thread-afternoon-530';
}
