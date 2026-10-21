import { describe, expect, it, vi } from "vitest";
import { clientIp, ipFrom } from "./client-ip";

// The visitor's IP address for the per-network send budget (Supabase phase B, review fix 2): Vercel's x-real-ip, else
// the first x-forwarded-for entry; none means none (and no block).

const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));

describe("ipFrom", () => {
  it("takes Vercel's x-real-ip first, trimmed", () => {
    expect(ipFrom(new Headers({ "x-real-ip": " 196.25.1.1 ", "x-forwarded-for": "10.0.0.1" }))).toBe("196.25.1.1");
  });

  it("else the first x-forwarded-for entry, trimmed", () => {
    expect(ipFrom(new Headers({ "x-forwarded-for": " 196.25.2.2 , 10.0.0.1, 10.0.0.2" }))).toBe("196.25.2.2");
    expect(ipFrom(new Headers({ "x-real-ip": "  ", "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("is null with neither, or only blanks", () => {
    expect(ipFrom(new Headers())).toBeNull();
    expect(ipFrom(new Headers({ "x-real-ip": "", "x-forwarded-for": " , 10.0.0.1" }))).toBeNull();
  });
});

describe("clientIp", () => {
  it("reads the request's headers", async () => {
    request.headers = new Headers({ "x-forwarded-for": "196.25.3.3" });
    expect(await clientIp()).toBe("196.25.3.3");
    request.headers = new Headers();
    expect(await clientIp()).toBeNull();
  });
});
