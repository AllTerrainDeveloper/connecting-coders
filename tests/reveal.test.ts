import { describe, expect, it } from "vitest";
import { revealTiming, revealOpacity } from "../lib/rendering/reveal";
describe("independent signal ignition", () => {
  it("assigns separate delays and fade speeds while completing each batch in five seconds", () => {
    const values = [0.1, 0.8, 0.9, 0.2];
    const random = () => values.shift()!;
    const a = revealTiming(random),
      b = revealTiming(random);
    expect(a.delay).not.toBe(b.delay);
    expect(a.duration).not.toBe(b.duration);
    for (const timing of [a, b]) {
      expect(timing.delay + timing.duration).toBeLessThanOrEqual(5000);
      expect(revealOpacity(timing.delay - 1, timing)).toBe(0);
      expect(
        revealOpacity(timing.delay + timing.duration / 2, timing),
      ).toBeCloseTo(0.5);
      expect(revealOpacity(5000, timing)).toBe(1);
    }
  });
  it("respects reduced motion without waiting for delayed reveals", () => {
    expect(revealOpacity(0, { delay: 3000, duration: 1500 }, true)).toBe(1);
  });
});
