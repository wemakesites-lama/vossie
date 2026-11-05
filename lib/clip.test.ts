import { describe, expect, it } from "vitest";
import { clipAtWord } from "./clip";

describe("clipAtWord (models can't count characters: cut, never refuse)", () => {
  it("keeps text that fits, with its spaces collapsed", () => {
    expect(clipAtWord("  Reply to   the 3 students  ", 70)).toBe("Reply to the 3 students");
  });
  it("cuts at the last word that fits, adding an ellipsis inside the limit", () => {
    const cut = clipAtWord("Add a second photo to Casio fx-991ZA Plus calculator, barely used, with its case", 40);
    expect(Array.from(cut).length).toBeLessThanOrEqual(40);
    expect(cut).toBe("Add a second photo to Casio fx-991ZA…");
  });
  it("cuts inside a word only when one word fills more than half", () => {
    expect(clipAtWord("Supercalifragilisticexpialidocious and more", 20)).toBe("Supercalifragilisti…");
  });
  it("drops trailing punctuation before the ellipsis", () => {
    expect(clipAtWord("Your oldest enquiry is 2 days old, and another, and another", 36)).toBe("Your oldest enquiry is 2 days old…");
  });
});
