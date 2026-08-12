import { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

type AnimatedCountProps = {
  value: number | null | undefined;
  decimals?: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  emptyLabel?: string;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function formatValue(v: number, decimals: number) {
  return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}

export function AnimatedCount({
  value,
  decimals = 0,
  duration = 1200,
  style,
  emptyLabel = '—',
}: AnimatedCountProps) {
  const fromRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const [display, setDisplay] = useState(() =>
    value == null || Number.isNaN(value) ? emptyLabel : formatValue(0, decimals),
  );

  useEffect(() => {
    if (value == null || Number.isNaN(value)) {
      fromRef.current = 0;
      setDisplay(emptyLabel);
      return;
    }

    const from = fromRef.current;
    const to = value;
    const start = performance.now();

    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
    }

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = from + (to - from) * easeOutCubic(progress);
      fromRef.current = next;
      setDisplay(formatValue(next, decimals));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(formatValue(to, decimals));
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [decimals, duration, emptyLabel, value]);

  return <Text style={style}>{display}</Text>;
}
