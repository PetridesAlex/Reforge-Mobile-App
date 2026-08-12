import { format } from 'date-fns';

import {
  isMembershipBillingReady,
  isMissingMembershipTableError,
  MEMBERSHIP_MIGRATION_HINT,
} from '@/lib/memberships/schema';
import { getSupabase } from '@/lib/supabase/client';
import type { MembershipRow, MembershipStats } from '@/services/admin';
import * as adminSupabase from '@/services/admin.supabase';
import type {
  MemberMembership,
  MembershipPayment,
  MembershipPlan,
  MembershipStatus,
} from '@/services/mock/data';
import type { Profile } from '@/types';

function mapMembership(row: Record<string, unknown>): MemberMembership {
  return {
    id: row.id as string,
    member_id: row.member_id as string,
    plan: row.plan as MembershipPlan,
    plan_label: row.plan_label as string,
    status: row.status as MembershipStatus,
    amount_eur: Number(row.amount_eur),
    period_start: row.period_start as string,
    period_end: row.period_end as string,
    last_paid_at: (row.last_paid_at as string) ?? null,
    notes: (row.notes as string) ?? null,
    updated_at: row.updated_at as string,
  };
}

function mapPayment(row: Record<string, unknown>): MembershipPayment {
  return {
    id: row.id as string,
    member_id: row.member_id as string,
    membership_id: row.membership_id as string,
    amount_eur: Number(row.amount_eur),
    kind: row.kind as MembershipPayment['kind'],
    status: row.status as MembershipPayment['status'],
    period_label: row.period_label as string,
    notes: (row.notes as string) ?? null,
    created_at: row.created_at as string,
  };
}

function mapProfile(row: Record<string, unknown>): Profile {
  return row as Profile;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function planMonths(plan: MembershipPlan): number {
  if (plan === 'annual') return 12;
  if (plan === 'quarterly') return 3;
  return 1;
}

async function ensureMembershipRow(memberId: string): Promise<MemberMembership> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('member_memberships')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) throw error;
  if (data) return mapMembership(data);

  const { data: created, error: insertError } = await supabase
    .from('member_memberships')
    .insert({
      member_id: memberId,
      plan_label: 'REFORGE Strength',
      status: 'unpaid',
      amount_eur: 180,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return mapMembership(created);
}

function defaultMembership(memberId: string): MemberMembership {
  const start = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  return {
    id: `pending-${memberId}`,
    member_id: memberId,
    plan: 'monthly',
    plan_label: 'REFORGE Strength',
    status: 'unpaid',
    amount_eur: 180,
    period_start: start,
    period_end: end.toISOString().slice(0, 10),
    last_paid_at: null,
    notes: null,
    updated_at: new Date().toISOString(),
  };
}

function filterAndSortRows(
  rows: MembershipRow[],
  filter?: { status?: MembershipStatus | 'all' | 'needs_payment' },
): MembershipRow[] {
  const status = filter?.status ?? 'all';
  let filtered = rows;
  if (status === 'needs_payment') {
    filtered = rows.filter(
      (r) => r.membership.status === 'unpaid' || r.membership.status === 'overdue',
    );
  } else if (status !== 'all') {
    filtered = rows.filter((r) => r.membership.status === status);
  }

  const order: Record<MembershipStatus, number> = {
    overdue: 0,
    unpaid: 1,
    trial: 2,
    paused: 3,
    paid: 4,
  };

  return filtered.sort(
    (a, b) =>
      order[a.membership.status] - order[b.membership.status] ||
      a.member.full_name.localeCompare(b.member.full_name),
  );
}

async function listMembershipsHybrid(filter?: {
  status?: MembershipStatus | 'all' | 'needs_payment';
}): Promise<MembershipRow[]> {
  const memberRows = await adminSupabase.listMembers();
  const rows: MembershipRow[] = memberRows.map(({ member, coach }) => ({
    membership: defaultMembership(member.id),
    member,
    coachName: coach?.full_name ?? null,
  }));
  return filterAndSortRows(rows, filter);
}

async function enrichRow(
  member: Profile,
  membership: MemberMembership,
  coachName: string | null,
): Promise<MembershipRow> {
  return {
    membership,
    member,
    coachName,
  };
}

export async function listMemberships(filter?: {
  status?: MembershipStatus | 'all' | 'needs_payment';
}): Promise<MembershipRow[]> {
  if (!(await isMembershipBillingReady())) {
    return listMembershipsHybrid(filter);
  }

  const supabase = getSupabase();

  const [{ data: members, error: membersError }, { data: memberships, error: memError }, { data: links, error: linksError }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'member').order('full_name'),
      supabase.from('member_memberships').select('*'),
      supabase.from('coach_clients').select('coach_id, member_id'),
    ]);

  if (membersError) throw membersError;
  if (memError) {
    if (isMissingMembershipTableError(memError)) return listMembershipsHybrid(filter);
    throw memError;
  }
  if (linksError) throw linksError;

  const membershipByMember = new Map(
    (memberships ?? []).map((m) => [m.member_id as string, mapMembership(m)]),
  );

  const coachIds = [...new Set((links ?? []).map((l) => l.coach_id as string))];
  const { data: coaches, error: coachesError } = coachIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', coachIds)
    : { data: [], error: null };
  if (coachesError) throw coachesError;

  const coachNameById = new Map((coaches ?? []).map((c) => [c.id as string, c.full_name as string]));
  const coachForMember = new Map(
    (links ?? []).map((l) => [
      l.member_id as string,
      coachNameById.get(l.coach_id as string) ?? null,
    ]),
  );

  let rows: MembershipRow[] = [];
  for (const row of members ?? []) {
    const member = mapProfile(row);
    let membership = membershipByMember.get(member.id);
    if (!membership) {
      membership = await ensureMembershipRow(member.id);
    }
    rows.push(await enrichRow(member, membership, coachForMember.get(member.id) ?? null));
  }

  return filterAndSortRows(rows, filter);
}

export async function getMembershipStats(): Promise<MembershipStats> {
  const rows = await listMemberships({ status: 'all' });
  const count = (s: MembershipStatus) => rows.filter((r) => r.membership.status === s).length;
  const unpaidish = rows.filter(
    (r) => r.membership.status === 'unpaid' || r.membership.status === 'overdue',
  );
  return {
    paid: count('paid'),
    unpaid: count('unpaid'),
    overdue: count('overdue'),
    trial: count('trial'),
    paused: count('paused'),
    total: rows.length,
    revenueDueEur: unpaidish.reduce((sum, r) => sum + r.membership.amount_eur, 0),
  };
}

export async function getMembershipForMember(memberId: string): Promise<MembershipRow | null> {
  if (!(await isMembershipBillingReady())) {
    const memberRows = await adminSupabase.listMembers();
    const row = memberRows.find((r) => r.member.id === memberId);
    if (!row) return null;
    return {
      membership: defaultMembership(memberId),
      member: row.member,
      coachName: row.coach?.full_name ?? null,
    };
  }

  const supabase = getSupabase();
  const { data: member, error: memberError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', memberId)
    .maybeSingle();

  if (memberError) throw memberError;
  if (!member) return null;

  const membership = await ensureMembershipRow(memberId);

  const { data: link } = await supabase
    .from('coach_clients')
    .select('coach_id')
    .eq('member_id', memberId)
    .maybeSingle();

  let coachName: string | null = null;
  if (link?.coach_id) {
    const { data: coach } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', link.coach_id)
      .maybeSingle();
    coachName = (coach?.full_name as string) ?? null;
  }

  return enrichRow(mapProfile(member), membership, coachName);
}

export async function getMembershipPaymentHistory(memberId: string): Promise<MembershipPayment[]> {
  if (!(await isMembershipBillingReady())) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('membership_payments')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapPayment);
}

async function recordPayment(
  membership: MemberMembership,
  input: {
    amountEur: number;
    kind: MembershipPayment['kind'];
    status: MembershipPayment['status'];
    periodLabel: string;
    notes?: string | null;
  },
): Promise<MembershipPayment> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('membership_payments')
    .insert({
      member_id: membership.member_id,
      membership_id: membership.id,
      amount_eur: input.amountEur,
      kind: input.kind,
      status: input.status,
      period_label: input.periodLabel,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapPayment(data);
}

function requireBillingSchema(): never {
  throw new Error(MEMBERSHIP_MIGRATION_HINT);
}

export async function updateMembership(
  memberId: string,
  patch: {
    status?: MembershipStatus;
    plan?: MembershipPlan;
    planLabel?: string;
    amountEur?: number;
    periodStart?: string;
    periodEnd?: string;
    notes?: string | null;
    markPaidNow?: boolean;
  },
): Promise<MembershipRow> {
  if (!(await isMembershipBillingReady())) requireBillingSchema();

  const supabase = getSupabase();
  const existing = await ensureMembershipRow(memberId);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status != null) updates.status = patch.status;
  if (patch.plan != null) updates.plan = patch.plan;
  if (patch.planLabel != null) updates.plan_label = patch.planLabel.trim();
  if (patch.amountEur != null) updates.amount_eur = Math.max(0, patch.amountEur);
  if (patch.periodStart != null) updates.period_start = patch.periodStart;
  if (patch.periodEnd != null) updates.period_end = patch.periodEnd;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  if (patch.markPaidNow) {
    const today = new Date().toISOString().slice(0, 10);
    const end = addMonths(new Date(), planMonths(existing.plan));
    updates.status = 'paid';
    updates.last_paid_at = today;
    updates.period_start = today;
    updates.period_end = end.toISOString().slice(0, 10);

    await recordPayment(existing, {
      amountEur: Number(updates.amount_eur ?? existing.amount_eur),
      kind: 'payment',
      status: 'paid',
      periodLabel: format(new Date(), 'MMMM yyyy'),
      notes: 'Marked paid by admin',
    });
  }

  const { error } = await supabase.from('member_memberships').update(updates).eq('member_id', memberId);
  if (error) throw error;

  const row = await getMembershipForMember(memberId);
  if (!row) throw new Error('Member not found');
  return row;
}

export async function markMembershipPaid(memberId: string): Promise<MembershipRow> {
  return updateMembership(memberId, { markPaidNow: true });
}

export async function markMembershipUnpaid(memberId: string): Promise<MembershipRow> {
  return updateMembership(memberId, { status: 'unpaid' });
}

export type MonthlyInvoiceResult = {
  sent: number;
  skipped: number;
  periodLabel: string;
};

export async function sendMonthlyInvoices(): Promise<MonthlyInvoiceResult> {
  if (!(await isMembershipBillingReady())) requireBillingSchema();

  const supabase = getSupabase();
  const periodLabel = format(new Date(), 'MMMM yyyy');
  const rows = await listMemberships({ status: 'all' });

  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const { membership, member } = row;
    if (membership.plan === 'drop-in') {
      skipped += 1;
      continue;
    }
    if (membership.status === 'paused') {
      skipped += 1;
      continue;
    }

    const { data: existing } = await supabase
      .from('membership_payments')
      .select('id')
      .eq('member_id', member.id)
      .eq('period_label', periodLabel)
      .eq('kind', 'invoice')
      .maybeSingle();

    if (existing) {
      skipped += 1;
      continue;
    }

    await recordPayment(membership, {
      amountEur: membership.amount_eur,
      kind: 'invoice',
      status: 'pending',
      periodLabel,
      notes: `${membership.plan_label} — ${periodLabel}`,
    });

    await supabase.from('notifications').insert({
      user_id: member.id,
      title: 'Membership invoice',
      body: `Your ${membership.plan_label} subscription for ${periodLabel} is €${membership.amount_eur}. Please arrange payment with the studio.`,
    });

    if (membership.status === 'paid') {
      await supabase
        .from('member_memberships')
        .update({ status: 'unpaid', updated_at: new Date().toISOString() })
        .eq('member_id', member.id);
    }

    sent += 1;
  }

  return { sent, skipped, periodLabel };
}

export { isMembershipBillingReady, MEMBERSHIP_MIGRATION_HINT };
