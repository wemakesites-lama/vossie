import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSampleEmail } from "@/lib/data/sign-in";
import { findAccountByEmail } from "@/lib/data/accounts";
import { resetSampleStore } from "@/lib/data/store";
import { SIGN_IN_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { startSignIn } from "@/lib/auth/actions";
import { redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form } from "@/tests/helpers/staff";
import { POST as POST_CODE } from "../code/route";
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

describe("POST /login/profile (stage K spec decision 2)", () => {
  async function toStep3(next: string) {
    await redirectSignalOf(() => startSignIn(form({ email: "new@eduvos.com", consent: "yes", next })));
    await POST_CODE(posted({ code: await sentCode(), next }).stand);
  }

  it("makes the account, signs in and answers 303 to next", async () => {
    await toStep3("/account");
    const response = await POST(posted({ firstName: "Ayanda", campus: "pretoria", next: "/account" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/account"]);
    expect(await findAccountByEmail("new@eduvos.com")).not.toBeNull();
  });

  it("answers 303 back to sign-in with a missing name, making nothing", async () => {
    await toStep3("/saved");
    const response = await POST(posted({ firstName: "", campus: "pretoria", next: "/saved" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login?next=%2Fsaved"]);
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });

  it("refuses a foreign post with 403, reading nothing", async () => {
    await toStep3("/account");
    const { stand, wasRead } = posted({ firstName: "Ayanda", campus: "pretoria" }, "https://evil.example");
    expect((await POST(stand)).status).toBe(403);
    expect(wasRead()).toBe(false);
    expect(await findAccountByEmail("new@eduvos.com")).toBeNull();
  });
});

describe("GET /login/profile", () => {
  it("answers 303 to /login", async () => {
    const response = await GET();
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login"]);
  });
});
