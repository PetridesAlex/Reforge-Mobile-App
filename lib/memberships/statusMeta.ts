import type { MembershipStatus } from '@/services/mock/data';

export type MembershipStatusTone = 'ok' | 'trial' | 'muted' | 'danger' | 'warn';

export type MembershipStatusMeta = {
  label: string;
  headline: string;
  body: string;
  icon: 'checkmark-circle' | 'sparkles' | 'pause-circle' | 'alert-circle' | 'card-outline';
  tone: MembershipStatusTone;
};

export function membershipStatusMeta(status: MembershipStatus | null): MembershipStatusMeta {
  switch (status) {
    case 'paid':
      return {
        label: 'Active',
        headline: 'Subscription active',
        body: 'Your membership is paid and up to date.',
        icon: 'checkmark-circle',
        tone: 'ok',
      };
    case 'trial':
      return {
        label: 'Trial',
        headline: 'Trial membership',
        body: 'Enjoy full access during your trial period.',
        icon: 'sparkles',
        tone: 'trial',
      };
    case 'paused':
      return {
        label: 'Paused',
        headline: 'Membership paused',
        body: 'Contact the studio if you want to resume training.',
        icon: 'pause-circle',
        tone: 'muted',
      };
    case 'overdue':
      return {
        label: 'Overdue',
        headline: 'Payment overdue',
        body: 'Please renew your subscription to keep full access.',
        icon: 'alert-circle',
        tone: 'danger',
      };
    case 'unpaid':
    default:
      return {
        label: 'Payment due',
        headline: 'Subscription needs payment',
        body: 'Contact your coach or the studio to complete payment.',
        icon: 'card-outline',
        tone: 'warn',
      };
  }
}

export function membershipNeedsPayment(status: MembershipStatus | null): boolean {
  return status === 'unpaid' || status === 'overdue';
}
