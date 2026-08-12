export type MotivationQuote = {
  text: string;
  author: string;
};

/** Training-focused quotes — rotates daily and on each home open. */
export const TRAINING_QUOTES: MotivationQuote[] = [
  { text: 'The only bad workout is the one that didn’t happen.', author: 'REFORGE' },
  { text: 'Discipline is choosing what you want most over what you want now.', author: 'REFORGE' },
  { text: 'Sweat now. Shine later.', author: 'REFORGE' },
  { text: 'Strength doesn’t come from what you can do. It comes from overcoming what you once thought you couldn’t.', author: 'REFORGE' },
  { text: 'Show up. Push hard. Recover well. Repeat.', author: 'REFORGE' },
  { text: 'Your body can stand almost anything. It’s your mind you have to convince.', author: 'REFORGE' },
  { text: 'Excuses don’t burn calories.', author: 'REFORGE' },
  { text: 'Train like you mean it. Live like you earned it.', author: 'REFORGE' },
  { text: 'Progress is built one rep at a time.', author: 'REFORGE' },
  { text: 'Be stronger than your strongest excuse.', author: 'REFORGE' },
  { text: 'The pain you feel today is the strength you feel tomorrow.', author: 'REFORGE' },
  { text: 'Don’t wish for it. Work for it.', author: 'REFORGE' },
  { text: 'Consistency beats intensity when intensity is inconsistent.', author: 'REFORGE' },
  { text: 'You don’t have to be extreme — just consistent.', author: 'REFORGE' },
  { text: 'Champions train when motivation fades.', author: 'REFORGE' },
  { text: 'Make your future self proud of today’s effort.', author: 'REFORGE' },
  { text: 'Hard work beats talent when talent doesn’t work hard.', author: 'REFORGE' },
  { text: 'Limassol strong. Mind sharper. Body forged.', author: 'REFORGE' },
  { text: 'Every session is a chance to rewrite your limits.', author: 'REFORGE' },
  { text: 'Comfort is the enemy of growth. Get uncomfortable.', author: 'REFORGE' },
  { text: 'Fall in love with the process and the results will come.', author: 'REFORGE' },
  { text: 'One more set. One more step. One more day.', author: 'REFORGE' },
  { text: 'You are one workout away from a better mood.', author: 'REFORGE' },
  { text: 'Forge the body. Fortify the mind.', author: 'REFORGE' },
  { text: 'Small gains compound into unstoppable strength.', author: 'REFORGE' },
  { text: 'The iron never lies. Show up and listen.', author: 'REFORGE' },
  { text: 'Today’s effort is tomorrow’s advantage.', author: 'REFORGE' },
  { text: 'Quit entertaining doubt. Start entertaining results.', author: 'REFORGE' },
  { text: 'You didn’t come this far to only come this far.', author: 'REFORGE' },
  { text: 'Stay hungry. Stay humble. Stay training.', author: 'REFORGE' },
  { text: 'Pressure creates diamonds. Training creates warriors.', author: 'REFORGE' },
  { text: 'Win the morning. Own the session. Close the day strong.', author: 'REFORGE' },
];

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

/** Stable quote for the calendar day. */
export function getDailyMotivationQuote(date = new Date()): MotivationQuote {
  const index = dayOfYear(date) % TRAINING_QUOTES.length;
  return TRAINING_QUOTES[index];
}

/** Fresh quote for each app/home open — avoids repeating the last one when possible. */
export function getFreshMotivationQuote(excludeText?: string): MotivationQuote {
  if (TRAINING_QUOTES.length === 1) return TRAINING_QUOTES[0];

  let next = TRAINING_QUOTES[Math.floor(Math.random() * TRAINING_QUOTES.length)];
  let guard = 0;
  while (excludeText && next.text === excludeText && guard < 8) {
    next = TRAINING_QUOTES[Math.floor(Math.random() * TRAINING_QUOTES.length)];
    guard += 1;
  }
  return next;
}
