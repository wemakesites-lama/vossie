import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccount } from "@/lib/data/accounts";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { FLASH_COOKIE } from "@/lib/flash";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { deleteAccount, signOut, updateDetails } from "./actions";
import { SESSION_COOKIE } from "./cookies";
import { DELETE_FORM, DETAILS_FORM, readFormState } from "./form-state";
import { hashToken } from "./secrets";
import { getViewer } from "./session";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

const NOW = new Date("2026-10-14T08:42:00.000Z");
const IN_30_DAYS = new Date("2026-11-13T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

/** A stored session for `accountId`, and its token in the browser's cookie. */
async function signedInAs(accountId: string, token = "token-1") {
  await createSession({ key: hashToken(token), accountId, createdAt: NOW, expiresAt: IN_30_DAYS });
  request.cookies.set(SESSION_COOKIE, token);
}

describe("signing out (accounts spec 2.5)", () => {
  it("ends the session, leaves the toast's code, and goes to the homepage", async () => {
    await signedInAs("acc-student");
    const redirect = await redirectSignalOf(() => signOut());
    expect([redirect.url, redirect.type]).toEqual(["/", undefined]);
    expect(sampleStore().sessions.size).toBe(0);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
    expect(request.cookies.get(FLASH_COOKIE)).toBe("signed-out");
    expect(request.sent.get(FLASH_COOKIE)?.options).toEqual({ sameSite: "lax", secure: false, path: "/", maxAge: 60 });
  });

  it("does no harm when already signed out", async () => {
    expect(await redirectOf(() => signOut())).toBe("/");
  });
});

describe("editing details (accounts spec 3.2)", () => {
  it("saves the first name and campus, and says so", async () => {
    await signedInAs("acc-student");
    const redirect = await redirectSignalOf(() => updateDetails(form({ firstName: " Thandiwe ", campus: "pretoria" })));
    expect([redirect.url, redirect.type]).toEqual(["/account", "replace"]);
    expect(await getAccount("acc-student")).toMatchObject({ firstName: "Thandiwe", campusSlug: "pretoria" });
    expect(await readFormState(DETAILS_FORM)).toMatchObject({ errors: [], notice: "saved" });
  });

  it("keeps what was typed and says what's wrong, changing nothing", async () => {
    await signedInAs("acc-student");
    await redirectSignalOf(() => updateDetails(form({ firstName: "T", campus: "atlantis" })));
    expect(await getAccount("acc-student")).toMatchObject({ firstName: "Thandi", campusSlug: "midrand" });
    expect(await readFormState(DETAILS_FORM)).toMatchObject({
      errors: ["first-name-length", "campus-missing"],
      values: { firstName: "T", campus: "" },
      notice: null,
    });
  });

  it("only ever changes the signed-in account, whatever the form carries (spec 5)", async () => {
    await signedInAs("acc-student");
    await redirectSignalOf(() =>
      updateDetails(form({ firstName: "Mallory", campus: "pretoria", accountId: "acc-admin", email: "admin@eduvos.com" })),
    );
    expect((await getAccount("acc-admin"))?.firstName).toBe("Pieter");
    expect((await getAccount("acc-student"))?.firstName).toBe("Mallory");
  });

  it("sends a signed-out visitor to sign in", async () => {
    expect(await redirectOf(() => updateDetails(form({ firstName: "Thandi", campus: "midrand" })))).toBe(
      "/login?next=%2Faccount",
    );
  });
});

describe("deleting the account (accounts spec 2.13)", () => {
  it("asks for the box first, deleting nothing", async () => {
    await signedInAs("acc-pending");
    const redirect = await redirectSignalOf(() => deleteAccount(form({})));
    expect([redirect.url, redirect.type]).toEqual(["/account/privacy", "replace"]);
    expect(await readFormState(DELETE_FORM)).toMatchObject({ errors: ["confirm-missing"] });
    expect(await getAccount("acc-pending")).not.toBeNull();
  });

  it("deletes the account and everything with it, signs out, and goes home with a toast", async () => {
    await signedInAs("acc-pending");
    expect(await redirectOf(() => deleteAccount(form({ confirm: "yes" })))).toBe("/");
    expect(await getAccount("acc-pending")).toBeNull();
    expect(sampleStore().sellerProfiles.has("acc-pending")).toBe(false);
    expect(sampleStore().sessions.size).toBe(0);
    expect(request.cookies.has(SESSION_COOKIE)).toBe(false);
    expect(request.cookies.get(FLASH_COOKIE)).toBe("deleted");
    expect(await getViewer()).toBeNull();
  });

  it("sends a signed-out visitor to sign in, deleting nothing", async () => {
    expect(await redirectOf(() => deleteAccount(form({ confirm: "yes" })))).toBe("/login?next=%2Faccount%2Fprivacy");
    expect(sampleStore().accounts.size).toBe(5);
  });

  it("takes a deleted seller's shop and listings out of the catalog at once, by expiring the sellers tag (selling spec 2.13, amendment 9.7)", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => deleteAccount(form({ confirm: "yes" })));
    expect(sampleStore().sellers.has("tech-corner")).toBe(false);
    expect(request.updatedTags).toEqual(["sellers"]);
  });

  it("expires nothing for an account with no shop, as buyers see nothing change", async () => {
    await signedInAs("acc-student");
    await redirectOf(() => deleteAccount(form({ confirm: "yes" })));
    expect(request.updatedTags).toEqual([]);
  });

  it("expires nothing when the box wasn't ticked", async () => {
    await signedInAs("acc-seller");
    await redirectOf(() => deleteAccount(form({})));
    expect(sampleStore().sellers.has("tech-corner")).toBe(true);
    expect(request.updatedTags).toEqual([]);
  });
});

describe("form state (plan decision 3)", () => {
  it("belongs to one session: another browser signed in to the same account doesn't see it", async () => {
    await signedInAs("acc-student");
    await redirectSignalOf(() => updateDetails(form({ firstName: "T", campus: "midrand" })));
    await signedInAs("acc-student", "token-2");
    expect(await readFormState(DETAILS_FORM)).toBeNull();
  });

  it("is none when signed out", async () => {
    expect(await readFormState(DETAILS_FORM)).toBeNull();
  });
});
