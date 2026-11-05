import { describe, expect, it } from "vitest";
import { placeCard } from "./place";

const phone = { width: 390, height: 844 };
const desk = { width: 1440, height: 900 };
const card = { width: 358, height: 180 };

describe("placeCard on phones (guided tour spec 3.2)", () => {
  it("sits at the bottom, above the tab bar, when the part is high", () => {
    const target = { x: 300, y: 10, width: 44, height: 44 };
    expect(placeCard({ target, viewport: phone, card, wide: false, bottomInset: 64 })).toEqual({
      x: 16,
      y: 844 - 64 - 180 - 16,
    });
  });

  it("moves to the top when the part is low, as the tab bar is", () => {
    const target = { x: 300, y: 790, width: 60, height: 50 };
    expect(placeCard({ target, viewport: phone, card, wide: false, bottomInset: 64 })).toEqual({ x: 16, y: 16 });
  });

  it("sits at the bottom when there's no part to show", () => {
    expect(placeCard({ target: null, viewport: phone, card, wide: false }).y).toBe(844 - 180 - 16);
  });
});

describe("placeCard from the tablet step", () => {
  const wideCard = { width: 352, height: 180 };

  it("sits below the part, lined up with its start edge", () => {
    const target = { x: 200, y: 60, width: 120, height: 44 };
    expect(placeCard({ target, viewport: desk, card: wideCard, wide: true })).toEqual({ x: 200, y: 60 + 44 + 12 });
  });

  it("goes above when there's no room below", () => {
    const target = { x: 200, y: 700, width: 120, height: 100 };
    expect(placeCard({ target, viewport: desk, card: wideCard, wide: true })).toEqual({ x: 200, y: 700 - 12 - 180 });
  });

  it("keeps 16px inside the right edge", () => {
    const target = { x: 1400, y: 60, width: 40, height: 40 };
    expect(placeCard({ target, viewport: desk, card: wideCard, wide: true }).x).toBe(1440 - 352 - 16);
  });

  it("stays on screen for a part taller than the screen", () => {
    const target = { x: 100, y: 20, width: 600, height: 870 };
    const at = placeCard({ target, viewport: desk, card: wideCard, wide: true });
    expect(at.y).toBe(900 - 180 - 16);
  });

  it("centres when there's no part to show", () => {
    expect(placeCard({ target: null, viewport: desk, card: wideCard, wide: true })).toEqual({
      x: (1440 - 352) / 2,
      y: (900 - 180) / 2,
    });
  });
});
