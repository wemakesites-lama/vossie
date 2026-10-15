import { describe, expect, it } from "vitest";
import { applyPhotoMove, parsePhotoMove, photoOrder, resolveToken } from "./photo-order";

const A = "/photos/ph-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "/photos/ph-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "/placeholders/listing/tech.svg";

describe("photo moves (selling spec 2.5 and section 4, plan decision 9)", () => {
  it("reads a button's value: the photo, then what to do", () => {
    expect(parsePhotoMove(`${A}:cover`)).toEqual({ token: A, op: "cover" });
    expect(parsePhotoMove("new:2:later")).toEqual({ token: "new:2", op: "later" });
    for (const bad of ["", ":cover", `${A}:jump`, A]) expect(parsePhotoMove(bad), bad).toBeNull();
  });

  it("moves a photo earlier or later, makes it the cover, or removes it", () => {
    const order = [A, B, C];
    expect(applyPhotoMove(order, { token: B, op: "earlier" })).toEqual([B, A, C]);
    expect(applyPhotoMove(order, { token: B, op: "later" })).toEqual([A, C, B]);
    expect(applyPhotoMove(order, { token: C, op: "cover" })).toEqual([C, A, B]);
    expect(applyPhotoMove(order, { token: A, op: "remove" })).toEqual([B, C]);
  });

  it("does nothing past either end, or for a photo that isn't there", () => {
    expect(applyPhotoMove([A, B], { token: A, op: "earlier" })).toEqual([A, B]);
    expect(applyPhotoMove([A, B], { token: B, op: "later" })).toEqual([A, B]);
    expect(applyPhotoMove([A, B], { token: C, op: "cover" })).toEqual([A, B]);
  });
});

describe("the photos' final order (plan decision 9)", () => {
  it("follows the posted order, turning new:<n> into the n-th stored upload", () => {
    expect(photoOrder(["new:1", A, "new:0"], new Set([A]), [B, C])).toEqual({ order: [C, A, B], tooMany: false });
  });

  it("drops what isn't allowed or was refused, adds uploads no token named, and never repeats one", () => {
    const stranger = "/photos/ph-cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    expect(photoOrder([stranger, A, A, "new:0", "new:9"], new Set([A]), [null, B])).toEqual({
      order: [A, B],
      tooMany: false,
    });
  });

  it("keeps 6 at most, and says when there were more", () => {
    const seven = Array.from({ length: 7 }, (_, n) => `/photos/ph-${String(n).repeat(8)}-0000-4000-8000-000000000000`);
    expect(photoOrder(seven, new Set(seven), [])).toEqual({ order: seven.slice(0, 6), tooMany: true });
  });

  it("turns a token into the address it stands for", () => {
    expect(resolveToken("new:1", [A, B])).toBe(B);
    expect(resolveToken("new:5", [A])).toBeNull();
    expect(resolveToken(C, [A])).toBe(C);
  });
});
