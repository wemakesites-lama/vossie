import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccountData } from "@/lib/data/accounts";
import { resetSampleStore } from "@/lib/data/store";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
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

describe("POST /login/sample (stage K spec decisions 2 to 4)", () => {
  it("signs in as the sample account and answers 303 to next", async () => {
    const response = await POST(posted({ email: "student@eduvos.com", next: "/looking-for/new" }).stand);
    expect([response.status, response.headers.get("location")]).toEqual([303, "/looking-for/new"]);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(true);
  });

  it("refuses a post from another site with 403: no login CSRF (spec decision 3)", async () => {
    const { stand, wasRead } = posted({ email: "student@eduvos.com" }, "https://evil.example");
    const response = await POST(stand);
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("This form must be sent from CampusCart.");
    expect(wasRead()).toBe(false);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("expires the sellers tag with revalidateTag when a sample shop comes back, never updateTag", async () => {
    await deleteAccountData("acc-seller");
    await POST(posted({ email: "seller@eduvos.com" }).stand);
    expect(request.revalidatedTags).toEqual([{ tag: "sellers", profile: { expire: 0 } }]);
    expect(request.updatedTags).toEqual([]);
  });
});

describe("GET /login/sample", () => {
  it("answers 303 to /login", async () => {
    const response = await GET();
    expect([response.status, response.headers.get("location")]).toEqual([303, "/login"]);
  });
});
