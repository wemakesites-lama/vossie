import { describe, expect, it } from "vitest";
import { icoFrom } from "./ico";

describe("icoFrom", () => {
  it("writes the header, one directory entry per image and the PNGs after them", () => {
    const a = Uint8Array.from([1, 2, 3]);
    const b = Uint8Array.from([4, 5]);
    const ico = icoFrom([
      { size: 16, png: a },
      { size: 256, png: b },
    ]);
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // icon
    expect(ico.readUInt16LE(4)).toBe(2); // count
    // First entry: 16 × 16, 32 bits, 3 bytes, right after the directory (6 + 2 × 16).
    expect([ico[6], ico[7]]).toEqual([16, 16]);
    expect(ico.readUInt16LE(6 + 6)).toBe(32);
    expect(ico.readUInt32LE(6 + 8)).toBe(3);
    expect(ico.readUInt32LE(6 + 12)).toBe(38);
    // Second entry: 256 is written as 0.
    expect([ico[22], ico[23]]).toEqual([0, 0]);
    expect(ico.readUInt32LE(22 + 12)).toBe(41);
    expect([...ico.subarray(38)]).toEqual([1, 2, 3, 4, 5]);
  });
});
