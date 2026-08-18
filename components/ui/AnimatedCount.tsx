import { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

type AnimatedCountProps = {
  value: number | null | undefined;
  decimals?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<TextStyle>;
  emptyLabel?: string;
  formatter?: (value: number) => string;
  suffix?: string;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function formatValue(v: number, decimals: number) {
  return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}

function renderValue(
  v: number,
  decimals: number,
  formatter?: (value: number) => string,
  suffix?: string,
) {
  const core = formatter ? formatter(v) : formatValue(v, decimals);
  return suffix ? `${core}${suffix}` : core;
}

export function AnimatedCount({
  value,
  decimals = 0,
  duration = 1200,
  delay = 0,
  style,
  emptyLabel = '—',
  formatter,
  suffix,
}: AnimatedCountProps) {
  const fromRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [display, setDisplay] = useState(() =>
    value == null || Number.isNaN(value)
      ? emptyLabel
      : renderValue(0, decimals, formatter, suffix),
  );

  useEffect(() => {
    if (value == null || Number.isNaN(value)) {
      fromRef.current = 0;
      setDisplay(emptyLabel);
      return;
    }

    const from = fromRef.current;
    const to = value;

    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (delayRef.current != null) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }

    const run = () => {
      const start = performance.now();

      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        const next = from + (to - from) * easeOutCubic(progress);
        fromRef.current = next;
        setDisplay(renderValue(next, decimals, formatter, suffix));
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(tick);
        } else {
          fromRef.current = to;
          setDisplay(renderValue(to, decimals, formatter, suffix));
          frameRef.current = null;
        }
      };

      frameRef.current = requestAnimationFrame(tick);
    };

    if (delay > 0) {
      delayRef.current = setTimeout(run, delay);
    } else {
      run();
    }

    return () => {
      if (delayRef.current != null) {
        clearTimeout(delayRef.current);
        delayRef.current = null;
      }
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [decimals, delay, duration, emptyLabel, formatter, suffix, value]);

  return <Text style={style}>{display}</Text>;
}
