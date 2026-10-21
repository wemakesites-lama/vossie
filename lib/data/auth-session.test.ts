import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAuthCookies,
  currentClaims,
  liveUserId,
  readClaims,
  sendSignInCode,
  signOutHere,
  verifySignInCode,
} from "./auth-session";

// The façade lib/auth reaches Supabase Auth through (phase B decision 5, amendment 4): on the sample backend it never
// loads the Supabase module; on Supabase it hands every call to it.

const twin = vi.hoisted(() => ({
  loaded: false,
  readClaims: vi.fn(async () => ({ userId: "u", sessionId: "s", email: "e@vossie.net" })),
  currentClaims: vi.fn(async () => ({ userId: "u", sessionId: "s", email: "e@vossie.net" })),
  liveUserId: vi.fn(async () => "u"),
  sendSignInCode: vi.fn(async () => "sent"),
  verifySignInCode: vi.fn(async () => ({ ok: true, userId: "u" })),
  signOutHere: vi.fn(async () => {}),
  clearAuthCookies: vi.fn(async () => {}),
}));

vi.mock("./supabase/auth-session", () => {
  twin.loaded = true;
  return twin;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("the auth session façade (phase B decision 5, amendment 4)", () => {
  it("on the sample backend, has no claims and loads no Supabase code", async () => {
    expect(await currentClaims()).toBeNull();
    expect(await readClaims()).toBeNull();
    expect(await liveUserId()).toBeNull();
    expect(twin.loaded).toBe(false);
  });

  it("on the sample backend, refuses the calls that only Supabase can answer", async () => {
    await expect(sendSignInCode("a@vossie.net")).rejects.toThrow("Supabase");
    await expect(verifySignInCode("a@vossie.net", "123456")).rejects.toThrow("Supabase");
    await expect(signOutHere()).rejects.toThrow("Supabase");
    await expect(clearAuthCookies()).rejects.toThrow("Supabase");
    expect(twin.loaded).toBe(false);
  });

  it("on Supabase, hands each call to lib/data/supabase/auth-session", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    expect(await currentClaims()).toEqual({ userId: "u", sessionId: "s", email: "e@vossie.net" });
    expect(await readClaims()).toEqual({ userId: "u", sessionId: "s", email: "e@vossie.net" });
    expect(await liveUserId()).toBe("u");
    expect(await sendSignInCode("a@vossie.net")).toBe("sent");
    expect(await verifySignInCode("a@vossie.net", "123456")).toEqual({ ok: true, userId: "u" });
    await signOutHere();
    await clearAuthCookies();
    expect(twin.sendSignInCode).toHaveBeenCalledWith("a@vossie.net");
    expect(twin.verifySignInCode).toHaveBeenCalledWith("a@vossie.net", "123456");
    expect(twin.signOutHere).toHaveBeenCalledTimes(1);
    expect(twin.clearAuthCookies).toHaveBeenCalledTimes(1);
  });
});
