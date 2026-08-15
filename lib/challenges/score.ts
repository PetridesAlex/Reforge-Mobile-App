export function parseChallengeScore(
  scoreType: string,
  display: string,
): { value: number; display: string } | null {
  const trimmed = display.trim();
  if (!trimmed) return null;

  if (scoreType === 'lowest_time') {
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return { value: Number(trimmed), display: trimmed };
    }
    const m = trimmed.match(/^(\d+):(\d{2})(?:\.(\d+))?$/);
    if (!m) return null;
    const seconds = Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(`0.${m[3]}`) : 0);
    return { value: seconds, display: trimmed };
  }

  const n = Number(trimmed.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return null;
  return { value: n, display: trimmed };
}
