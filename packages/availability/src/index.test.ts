import { describe, expect, it } from "vitest";
import { SLOT_MINUTES, durationToSlots, totalDuration } from "./index";

describe("durationToSlots", () => {
  it("рахує слоти по 15 хвилин", () => {
    expect(SLOT_MINUTES).toBe(15);
    expect(durationToSlots(15)).toBe(1);
    expect(durationToSlots(60)).toBe(4);
    expect(durationToSlots(120)).toBe(8);
  });

  it("відхиляє тривалість не кратну 15 хвилинам", () => {
    expect(() => durationToSlots(20)).toThrow(RangeError);
  });

  it("відхиляє нульову, від'ємну і дробову тривалість", () => {
    expect(() => durationToSlots(0)).toThrow(RangeError);
    expect(() => durationToSlots(-15)).toThrow(RangeError);
    expect(() => durationToSlots(7.5)).toThrow(RangeError);
  });
});

describe("totalDuration", () => {
  it("сумує тривалості послуг", () => {
    expect(totalDuration([60, 30, 15])).toBe(105);
    expect(totalDuration([])).toBe(0);
  });
});
