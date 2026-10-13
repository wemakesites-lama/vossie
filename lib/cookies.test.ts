import { describe, expect, it } from "vitest";
import { preferenceCookie, readCookie } from "./cookies";

describe("preference cookies (shopping spec 5.1)", () => {
  it("builds a one-year Lax cookie for the whole site, adding Secure only on https", () => {
    expect(preferenceCookie("vossie_saved", "l-001", false)).toBe(
      "vossie_saved=l-001; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(preferenceCookie("vossie_saved", "l-001", true)).toMatch(/; Secure$/);
  });

  it("deletes the cookie when the value is empty", () => {
    expect(preferenceCookie("vossie_saved", "", false)).toBe("vossie_saved=; Path=/; Max-Age=0; SameSite=Lax");
  });

  it("reads one cookie's raw value, keeping any = inside it", () => {
    expect(readCookie("theme=dark; vossie_saved=l-001.l-002; other=a=b", "vossie_saved")).toBe("l-001.l-002");
    expect(readCookie("theme=dark; other=a=b", "other")).toBe("a=b");
    expect(readCookie("theme=dark", "vossie_saved")).toBeNull();
    expect(readCookie("", "vossie_saved")).toBeNull();
  });
});
