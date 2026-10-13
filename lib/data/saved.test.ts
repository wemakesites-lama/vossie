import { afterEach, describe, expect, it, vi } from "vitest";
import { getSavedIds } from "./saved";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "vossie_saved" && cookieValue.current !== undefined ? { value: cookieValue.current } : undefined,
  }),
}));

afterEach(() => {
  cookieValue.current = undefined;
});

describe("getSavedIds (shopping spec 5.1)", () => {
  it("reads the saved ids from the cookie, newest first", async () => {
    cookieValue.current = "l-003.l-001";
    expect(await getSavedIds()).toEqual(["l-003", "l-001"]);
  });

  it("has none without the cookie", async () => {
    expect(await getSavedIds()).toEqual([]);
  });

  it("drops bad values and repeats, as the browser does", async () => {
    cookieValue.current = "l-001.<script>.l-001.l-002";
    expect(await getSavedIds()).toEqual(["l-001", "l-002"]);
  });
});
