import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renewFromProxy } from "./session-renewal";

// The proxy's façade (phase B decision 5, amendment 4): it returns at once, loading no Supabase code, on the sample
// backend and for a visitor with no vossie_auth cookie ("signed-out visitors pay nothing", spec 5). Task 6 tests the
// renewal itself.

const twin = vi.hoisted(() => ({ loaded: false, renewFromProxy: vi.fn(async () => new Response(null, { status: 299 })) }));
vi.mock("./supabase/session-renewal", () => {
  twin.loaded = true;
  return twin;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const request = (cookie?: string) =>
  new NextRequest("https://vossie-pi.vercel.app/account", { headers: cookie ? { cookie } : {} });

describe("renewFromProxy's early returns (phase B, Task 4)", () => {
  it("passes the request on, loading nothing, on the sample backend", async () => {
    const response = await renewFromProxy(request("vossie_auth=base64-x"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(twin.loaded).toBe(false);
  });

  it("passes the request on, loading nothing, on Supabase without a vossie_auth cookie", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    const response = await renewFromProxy(request("vossie_session=x; vossie_authx=y; vossie_auth=; vossie_campus=pretoria"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(twin.loaded).toBe(false);
  });

  it("hands a request with the cookie, or one of its chunks, to the Supabase module", async () => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    const withChunk = request("vossie_auth.0=base64-x");
    expect((await renewFromProxy(withChunk)).status).toBe(299);
    expect(twin.renewFromProxy).toHaveBeenCalledWith(withChunk);
    expect(NextResponse).toBeDefined();
  });
});
