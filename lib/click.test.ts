import type { MouseEvent } from "react";
import { describe, expect, it } from "vitest";
import { isPlainClick } from "./click";

type ClickInit = Partial<Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">>;

/** The parts of a click that isPlainClick reads. A plain primary click unless told otherwise. */
const click = (init: ClickInit = {}) =>
  ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...init }) as MouseEvent;

describe("isPlainClick", () => {
  it("accepts a plain primary click", () => {
    expect(isPlainClick(click())).toBe(true);
  });

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)("rejects a click with %s held", (modifier) => {
    expect(isPlainClick(click({ [modifier]: true }))).toBe(false);
  });

  it.each([
    ["middle", 1],
    ["secondary", 2],
  ])("rejects a %s button click", (_name, button) => {
    expect(isPlainClick(click({ button }))).toBe(false);
  });

  it("rejects a modified click on another button too", () => {
    expect(isPlainClick(click({ button: 1, metaKey: true }))).toBe(false);
  });
});
