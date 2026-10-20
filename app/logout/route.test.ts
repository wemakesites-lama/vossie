import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { FLASH_COOKIE } from "@/lib/flash";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs } from "@/tests/helpers/staff";
import { GET, POST } from "./route";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
});

/** A form post, as the browser sends it from `origin` (jsdom's FormData can't be a real Request's body). */
function posted(origin: string | null = "http://localhost:3204") {
  const headers = new Headers({ host: "localhost:3204" });
  if (origin) headers.set("origin", origin);
  let read = false;
  const stand = {
    headers,
    formData: async () => {
      read = true;
      return form({});
    },
  } as unknown as Request;
  return { stand, wasRead: () => read };
}

describe("POST /logout (Lama, 2026-10-20; stage K plan decision 2)", () => {
  it("ends the session, leaves the homepage's toast and answers 303 to /", async () => {
    await signedInAs(request, "acc-student");
    const key = hashToken("token-acc-student");
    expect(sampleStore().sessions.has(key)).toBe(true);
    const response = await POST(posted().stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/"]);
    expect(sampleStore().sessions.has(key)).toBe(false);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
    expect(request.sent.get(FLASH_COOKIE)?.value).toBe("signed-out");
    expect(request.sent.get(FLASH_COOKIE)?.options).toEqual({ sameSite: "lax", secure: false, path: "/", maxAge: 60 });
  });

  it("says signed out even when there was no session, as the Server Action did", async () => {
    const response = await POST(posted().stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/"]);
    expect(request.sent.get(FLASH_COOKIE)?.value).toBe("signed-out");
  });

  it("accepts a post with no Origin but a same-host Referer (proxy browsers)", async () => {
    const stand = {
      headers: new Headers({ host: "localhost:3204", referer: "http://localhost:3204/account" }),
      formData: async () => form({}),
    } as unknown as Request;
    expect((await POST(stand)).status).toBe(303);
  });

  it("answers a malformed body with a 303, not a 500, and signs nobody out (amendment 9)", async () => {
    await signedInAs(request, "acc-student");
    const stand = {
      headers: new Headers({ host: "localhost:3204", origin: "http://localhost:3204" }),
      formData: async () => {
        throw new TypeError("bad body");
      },
    } as unknown as Request;
    const response = await POST(stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/"]);
    expect(sampleStore().sessions.has(hashToken("token-acc-student"))).toBe(true);
  });

  it("refuses a post from another site with 403, touching nothing", async () => {
    await signedInAs(request, "acc-student");
    for (const origin of ["https://evil.example", null]) {
      const { stand, wasRead } = posted(origin);
      const response = await POST(stand);
      expect(response.status).toBe(403);
      expect(wasRead()).toBe(false);
    }
    expect(sampleStore().sessions.has(hashToken("token-acc-student"))).toBe(true);
    expect(request.sent.size).toBe(0);
  });
});

describe("GET /logout", () => {
  it("answers 303 to / and signs nobody out: a link can't end a session", async () => {
    await signedInAs(request, "acc-student");
    const response = await GET();
    expect([response.status, response.headers.get("location")]).toEqual([303, "/"]);
    expect(sampleStore().sessions.has(hashToken("token-acc-student"))).toBe(true);
  });
});
