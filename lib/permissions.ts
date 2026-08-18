import type { UserRole } from '@/types';

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function isCoachOrAdmin(role: UserRole | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

/** Full studio control: members, staff, roles, settings, chat, classes, WOD, news. */
export function canManageStudio(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

/** See and manage every member in the studio (not only assigned clients). */
export function canManageAllClients(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function canEditPrograms(role: UserRole | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

export function canManageClasses(role: UserRole | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

export function canManageMemberships(role: UserRole | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

export function canManageStaff(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function canManageNews(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

/** REFORGE Store catalog, inventory, and fulfillment — admin only (Phase 1). */
export function canManageStore(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function canManageWod(role: UserRole | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

/** Weekly challenges, result verification, achievement awards. */
export function canManageChallenges(role: UserRole | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

export function canManageAchievements(role: UserRole | null | undefined): boolean {
  return role === 'coach' || role === 'admin';
}

/** Admin sees every group chat; coaches see groups they lead. */
export function canManageAllChats(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

export function canAccessGroupChat(role: UserRole | null | undefined): boolean {
  return role === 'member' || role === 'coach' || role === 'admin';
}

/** Member-style community feed, compose, likes, comments, saves. */
export function canAccessCommunity(role: UserRole | null | undefined): boolean {
  return role === 'member' || role === 'coach' || role === 'admin';
}

/** Pin / remove / hide any community post — admin only. */
export function canModerateCommunity(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}
