import type { Ionicons } from '@expo/vector-icons';

export type MemberGuideStep = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
  bullets?: string[];
  ctaLabel?: string;
  ctaHref?: string;
};

export const MEMBER_APP_GUIDE_STEPS: MemberGuideStep[] = [
  {
    id: 'welcome',
    kicker: 'WELCOME',
    title: 'Train with REFORGE',
    body:
      'Your coach publishes workouts, studio news, and class schedules here. Everything syncs to your phone — no spreadsheets, no guesswork.',
    icon: 'flash-outline',
    accent: '#C8FF00',
    bullets: ['Limassol studio coaching', 'Programs & WOD on Home', 'Book classes in seconds'],
  },
  {
    id: 'home',
    kicker: 'HOME',
    title: 'Your daily command center',
    body:
      'Start on Home for today’s Workout of the Day, streak, studio announcements, and quick actions like Train Solo or Book Session.',
    icon: 'home-outline',
    accent: '#C8FF00',
    bullets: ['Workout of the Day card', 'Weekly progress ring', 'Studio news & chat alerts'],
  },
  {
    id: 'workouts',
    kicker: 'WORKOUTS',
    title: 'Programs & session logging',
    body:
      'Browse Strength, Cardio, and coach categories. Open a session, follow prescriptions, log sets, and finish with a summary.',
    icon: 'barbell-outline',
    accent: '#60A5FA',
    bullets: ['Category library', 'Set logger & rest timer', 'Report absences when needed'],
  },
  {
    id: 'bookings',
    kicker: 'SESSIONS',
    title: 'Book classes & privates',
    body:
      'Reserve group classes or private slots with your coach. Open Sessions from the crown menu or Home quick actions.',
    icon: 'calendar-outline',
    accent: '#F59E0B',
    bullets: ['Upcoming bookings list', 'Join class rosters', 'Session details & location'],
    ctaLabel: 'Open Sessions',
    ctaHref: '/(member)/bookings',
  },
  {
    id: 'messages',
    kicker: 'MESSAGES',
    title: 'Coach & group chat',
    body:
      'Message your coach privately or join class groups. New invites and replies appear in your chat alerts inbox.',
    icon: 'chatbubbles-outline',
    accent: '#34D399',
    bullets: ['Coach DMs', 'Class group chats', 'Notification inbox'],
    ctaLabel: 'Open Messages',
    ctaHref: '/(member)/messages',
  },
  {
    id: 'progress',
    kicker: 'PROGRESS',
    title: 'Track your stats',
    body:
      'Set height, goals, and weekly targets once — then log weight and watch streaks, volume, and trends build over time.',
    icon: 'trending-up-outline',
    accent: '#A78BFA',
    bullets: ['Profile setup wizard', 'Weight log & charts', 'Weekly goal ring on Home'],
    ctaLabel: 'Set up Progress',
    ctaHref: '/(member)/progress/setup',
  },
  {
    id: 'ready',
    kicker: 'YOU\'RE SET',
    title: 'Time to train',
    body:
      'Your account is saved securely in the cloud. Coaches see the same roster, WOD, and bookings you do — always in sync.',
    icon: 'checkmark-done-outline',
    accent: '#C8FF00',
    bullets: ['Profile photo anytime', 'Crown menu for extras', 'Replay this guide from Profile'],
  },
];
