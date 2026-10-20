import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSampleEmail } from "@/lib/data/sign-in";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { SESSION_COOKIE, SIGN_IN_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { startSignIn } from "@/lib/auth/actions";
import { redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";
import { GET, POST } from "./route";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T08:42:00.000Z"));
});

/** A form post from `origin`, as the browser sends it (conventions: a stand-in, since jsdom's FormData can't be a body). */
function posted(fields: Record<string, string>, origin: string | null = "http://localhost:3204") {
  const headers = new Headers({ host: "localhost:3204" });
  if (origin) headers.set("origin", origin);
  let read = false;
  const stand = {
    headers,
    formData: async () => {
      read = true;
      return form(fields);
    },
  } as unknown as Request;
  return { stand, wasRead: () => read };
}

async function sentCode(): Promise<string> {
  const token = request.cookies.get(SIGN_IN_COOKIE)!;
  return (await getSampleEmail(hashToken(token)))!.code;
}

describe("POST /login/code (stage K spec decision 2)", () => {
  it("signs an existing account in and answers 303 to next, a relative path", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: "student@eduvos.com", consent: "yes", next: "/looking-for/new" })));
    const response = await POST(posted({ code: await sentCode(), next: "/looking-for/new" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/looking-for/new"]);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(true);
  });

  it("answers 303 back to sign-in, keeping next, on a wrong code", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: "student@eduvos.com", consent: "yes" })));
    const wrong = (await sentCode()) === "111111" ? "222222" : "111111";
    const response = await POST(posted({ code: wrong, next: "/saved" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login?next=%2Fsaved"]);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("refuses a post from another site, or with no Origin, with 403, reading and writing nothing", async () => {
    await redirectSignalOf(() => startSignIn(form({ email: "student@eduvos.com", consent: "yes" })));
    const code = await sentCode();
    const attempts = sampleStore().signInAttempts.size;
    for (const origin of ["https://evil.example", null]) {
      const { stand, wasRead } = posted({ code }, origin);
      const response = await POST(stand);
      expect(response.status).toBe(403);
      expect(wasRead()).toBe(false);
    }
    expect(sampleStore().signInAttempts.size).toBe(attempts);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });
});

describe("GET /login/code", () => {
  it("answers 303 to /login", async () => {
    const response = await GET();
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login"]);
  });
});
