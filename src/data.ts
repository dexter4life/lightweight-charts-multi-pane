export interface Bar {
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const DAY = 86400;

// Same seeded generator as the reference harness so both charts show identical candles.
export function genBars(n = 600, resSec = DAY, base = 65000, seed0 = 7): Bar[] {
  const bars: Bar[] = [];
  let t = Math.floor(Date.UTC(2026, 9, 15) / 1000 / resSec) * resSec - n * resSec;
  const k = base / 65000;
  let p = base;
  let seed = seed0;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    const open = p;
    const close = open + (rnd() - 0.5) * 1400 * k;
    const high = Math.max(open, close) + rnd() * 500 * k;
    const low = Math.min(open, close) - rnd() * 500 * k;
    bars.push({ time: t, open, high, low, close, volume: 100 + rnd() * 900 });
    p = close;
    t += resSec;
  }
  return bars;
}
