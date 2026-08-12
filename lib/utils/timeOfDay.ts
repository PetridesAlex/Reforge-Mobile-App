export type DayPeriod = 'night' | 'morning' | 'afternoon' | 'evening';

export type DayPeriodVisuals = {
  period: DayPeriod;
  icon: 'moon-outline' | 'sunny-outline' | 'partly-sunny-outline';
  label: string;
  title: string;
  message: string;
  gradient: [string, string, string];
  accent: string;
  border: string;
};

export function getDayPeriod(date = new Date()): DayPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function getDayPeriodVisuals(date = new Date(), firstName?: string): DayPeriodVisuals {
  const period = getDayPeriod(date);
  const hour = date.getHours();
  const name = firstName?.trim() || 'Coach';
  const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  switch (period) {
    case 'morning':
      return {
        period,
        icon: 'sunny-outline',
        label: 'Morning',
        title: hour < 7 ? 'Early start' : 'Good morning',
        message:
          hour < 7
            ? `${name}, it’s ${timeLabel} — the city is waking up. Studio opens at 07:00.`
            : `${name}, it’s ${timeLabel} — fresh energy on the floor. Today starts at REFORGE.`,
        gradient: ['rgba(255,200,80,0.12)', 'rgba(200,255,0,0.04)', 'transparent'],
        accent: '#FCD34D',
        border: 'rgba(252,211,77,0.35)',
      };
    case 'afternoon':
      return {
        period,
        icon: 'sunny-outline',
        label: 'Afternoon',
        title: 'Peak hours',
        message: `${name}, ${timeLabel} — members are training. Keep the floor moving.`,
        gradient: ['rgba(200,255,0,0.09)', 'rgba(200,255,0,0.02)', 'transparent'],
        accent: '#C8FF00',
        border: 'rgba(200,255,0,0.28)',
      };
    case 'evening':
      return {
        period,
        icon: 'partly-sunny-outline',
        label: 'Evening',
        title: 'Evening session',
        message: `${name}, ${timeLabel} — last sessions rolling. Strong finish to the day.`,
        gradient: ['rgba(251,146,60,0.1)', 'rgba(200,255,0,0.03)', 'transparent'],
        accent: '#FB923C',
        border: 'rgba(251,146,60,0.32)',
      };
    case 'night':
    default:
      return {
        period: 'night',
        icon: 'moon-outline',
        label: 'Night',
        title: 'Night mode',
        message: `${name}, ${timeLabel} — studio quiet. Rest, recover, come back stronger.`,
        gradient: ['rgba(96,165,250,0.1)', 'rgba(147,51,234,0.04)', 'transparent'],
        accent: '#93C5FD',
        border: 'rgba(147,197,253,0.28)',
      };
  }
}
