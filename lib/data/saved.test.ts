import { afterEach, describe, expect, it, vi } from "vitest";
import { getSavedIds } from "./saved";

// The raw Cookie request header, as the server receives it.
const cookieHeader = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "cookie" ? (cookieHeader.current ?? null) : null),
  }),
}));

afterEach(() => {
  cookieHeader.current = undefined;
});

describe("getSavedIds (shopping spec 5.1)", () => {
  it("reads the saved ids from the cookie, newest first", async () => {
    cookieHeader.current = "vossie_saved=l-003.l-001";
    expect(await getSavedIds()).toEqual(["l-003", "l-001"]);
  });

  it("has none without the cookie", async () => {
    expect(await getSavedIds()).toEqual([]);
  });

  it("drops bad values and repeats, as the browser does", async () => {
    cookieHeader.current = "vossie_saved=l-001.<script>.l-001.l-002";
    expect(await getSavedIds()).toEqual(["l-001", "l-002"]);
  });

  it("takes the first of two cookies with the name, as the browser does", async () => {
    cookieHeader.current = "vossie_saved=l-001; theme=x; vossie_saved=l-002";
    expect(await getSavedIds()).toEqual(["l-001"]);
  });

  it("drops a percent-encoded id instead of decoding it, as the browser does", async () => {
    cookieHeader.current = "vossie_saved=%6C-001";
    expect(await getSavedIds()).toEqual([]);
  });
});
