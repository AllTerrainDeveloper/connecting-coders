export interface RevealTiming {
  delay: number;
  duration: number;
}
/** Independent timing per signal; every light finishes inside its five-second batch. */
export function revealTiming(random: () => number = Math.random): RevealTiming {
  const duration = 800 + random() * 1600;
  return { duration, delay: random() * (5000 - duration) };
}
export function revealOpacity(
  elapsed: number,
  timing: RevealTiming,
  reduced = false,
) {
  if (reduced) return 1;
  const t = Math.max(
    0,
    Math.min(1, (elapsed - timing.delay) / timing.duration),
  );
  return t * t * (3 - 2 * t);
}
