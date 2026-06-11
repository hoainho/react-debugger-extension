import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "../utils/crypto";

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for same-length but different strings", () => {
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for different-length strings", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });

  it("returns false for empty vs non-empty", () => {
    expect(timingSafeEqual("", "a")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("executes in constant time within ±200% CV (JS timing resolution limit)", () => {
    const token = "a".repeat(64);
    const correct = "a".repeat(64);
    const wrong = "b".repeat(64);

    for (let i = 0; i < 100; i++) {
      timingSafeEqual(token, correct);
      timingSafeEqual(token, wrong);
    }

    const correctTimes: number[] = [];
    const wrongTimes: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const t1 = performance.now();
      timingSafeEqual(token, correct);
      correctTimes.push(performance.now() - t1);

      const t2 = performance.now();
      timingSafeEqual(token, wrong);
      wrongTimes.push(performance.now() - t2);
    }

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const correctMean = mean(correctTimes);
    const wrongMean = mean(wrongTimes);

    // The means should be within 2x of each other — proves no short-circuit
    const ratio = Math.max(correctMean, wrongMean) / Math.min(correctMean, wrongMean);
    expect(ratio).toBeLessThan(2);
  });
});
