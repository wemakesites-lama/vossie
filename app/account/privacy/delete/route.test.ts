import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { DELETE_FORM, readFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { getViewer } from "@/lib/auth/session";
import { getAccount } from "@/lib/data/accounts";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { FLASH_COOKIE } from "@/lib/flash";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs } from "@/tests/helpers/staff";
import { GET, POST } from "./route";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

const PAGE = "/account/privacy";

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
});

/** A form post, as the browser sends it from `origin`, carrying `fields` (jsdom's FormData can't be a real Request's body). */
function posted(fields: Record<string, string> = {}, origin: string | null = "http://localhost:3204") {
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

const answer = (response: Response) => [response.status, response.headers.get("location")];

describe("POST /account/privacy/delete (accounts spec 2.13; stage K decision 54)", () => {
  it("asks for the box first, deleting nothing, and goes back to the page with the error in the form's state", async () => {
    await signedInAs(request, "acc-pending");
    const response = await POST(posted().stand);
    expect(answer(response)).toEqual([303, PAGE]);
    expect(await readFormState(DELETE_FORM)).toMatchObject({ errors: ["confirm-missing"] });
    expect(await getAccount("acc-pending")).not.toBeNull();
    expect(request.revalidatedTags).toEqual([]);
  });

  it("deletes the account and everything with it, signs out, leaves the toast and answers 303 to /", async () => {
    await signedInAs(request, "acc-pending");
    const response = await POST(posted({ confirm: "yes" }).stand);
    expect(answer(response)).toEqual([303, "/"]);
    expect(await getAccount("acc-pending")).toBeNull();
    expect(sampleStore().sellerProfiles.has("acc-pending")).toBe(false);
    expect(sampleStore().sessions.size).toBe(0);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
    expect(request.sent.get(FLASH_COOKIE)?.value).toBe("deleted");
    expect(await getViewer()).toBeNull();
  });

  it("sends a signed-out visitor to sign in, deleting nothing", async () => {
    const response = await POST(posted({ confirm: "yes" }).stand);
    expect(answer(response)).toEqual([303, "/login?next=%2Faccount%2Fprivacy"]);
    expect(sampleStore().accounts.size).toBe(5);
  });

  it("takes a deleted seller's shop out of the catalog at once, with revalidateTag (never updateTag), the Hub and the board too", async () => {
    await signedInAs(request, "acc-seller");
    await POST(posted({ confirm: "yes" }).stand);
    expect(sampleStore().sellers.has("tech-corner")).toBe(false);
    expect(request.revalidatedTags).toEqual([
      { tag: "sellers", profile: { expire: 0 } },
      { tag: "hub", profile: { expire: 0 } },
      { tag: "requests", profile: { expire: 0 } },
    ]);
    expect(request.updatedTags).toEqual([]);
  });

  it("expires only the Hub's and the board's tags for an account with no shop", async () => {
    await signedInAs(request, "acc-student");
    await POST(posted({ confirm: "yes" }).stand);
    expect(request.revalidatedTags?.map((entry) => entry.tag)).toEqual(["hub", "requests"]);
  });

  it("expires nothing when the box wasn't ticked", async () => {
    await signedInAs(request, "acc-seller");
    await POST(posted().stand);
    expect(sampleStore().sellers.has("tech-corner")).toBe(true);
    expect(request.revalidatedTags).toEqual([]);
  });

  it("answers a malformed body with a 303 back to the page, not a 500, deleting nothing", async () => {
    await signedInAs(request, "acc-student");
    const stand = {
      headers: new Headers({ host: "localhost:3204", origin: "http://localhost:3204" }),
      formData: async () => {
        throw new TypeError("bad body");
      },
    } as unknown as Request;
    expect(answer(await POST(stand))).toEqual([303, PAGE]);
    expect(await getAccount("acc-student")).not.toBeNull();
    expect(sampleStore().sessions.has(hashToken("token-acc-student"))).toBe(true);
  });

  it("refuses a post from another site with 403, touching nothing", async () => {
    await signedInAs(request, "acc-student");
    for (const origin of ["https://evil.example", null]) {
      const { stand, wasRead } = posted({ confirm: "yes" }, origin);
      expect((await POST(stand)).status).toBe(403);
      expect(wasRead()).toBe(false);
    }
    expect(await getAccount("acc-student")).not.toBeNull();
    expect(request.sent.size).toBe(0);
  });
});

describe("GET /account/privacy/delete", () => {
  it("answers 303 to the page and deletes nothing: a link can't delete an account", async () => {
    await signedInAs(request, "acc-student");
    expect(answer(await GET())).toEqual([303, PAGE]);
    expect(await getAccount("acc-student")).not.toBeNull();
  });
});
