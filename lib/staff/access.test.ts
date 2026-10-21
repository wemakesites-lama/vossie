import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { Refused } from "@/lib/data/refused";
import type { Account } from "@/lib/types";
import { redirectOf, RedirectSignal, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { firstGate, functionsIn, isExported, parse, staffActionFiles } from "@/tests/helpers/action-sources";
import { orNotFound, requireStaff, requireStaffAction, staffMetadata } from "./access";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
// The live re-check (phase B's requireLiveAccount) is the real one, unless a test stands in for Supabase's answer.
const live = vi.hoisted(() => ({ check: null as null | ((nextPath: string) => Promise<Account>) }));
vi.mock("@/lib/auth/session", async (original) => {
  const session = await original<typeof import("@/lib/auth/session")>();
  return {
    ...session,
    requireLiveAccount: (nextPath: string) => (live.check ? live.check(nextPath) : session.requireLiveAccount(nextPath)),
  };
});

beforeEach(() => {
  live.check = null;
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

describe("the staff gate (staff tools spec 2.1, plan decision 1)", () => {
  it("sends a signed-out visitor to sign in, coming back to the page afterwards", async () => {
    expect(await redirectOf(() => requireStaff("admin", "/admin/reports"))).toBe("/login?next=%2Fadmin%2Freports");
  });

  it("gives anyone signed in without the role the 404, not a forbidden page", async () => {
    await signedInAs(request, "acc-student");
    await expect(requireStaff("hub", "/hub/manage")).rejects.toThrow("notFound");
    await signedInAs(request, "acc-mentor");
    await expect(requireStaff("admin", "/admin")).rejects.toThrow("notFound");
  });

  it("lets staff in, as their own account", async () => {
    await signedInAs(request, "acc-mentor");
    expect((await requireStaff("mentor", "/mentor")).id).toBe("acc-mentor");
    await signedInAs(request, "acc-admin");
    expect((await requireStaff("hub", "/hub/manage")).firstName).toBe("Pieter");
  });

  it("titles the tab for staff, and \"Page not found\" for everyone else, never indexed", async () => {
    const robots = { index: false, follow: false };
    expect(await staffMetadata("admin", "Reports")).toEqual({ title: "Page not found", robots });
    await signedInAs(request, "acc-mentor");
    expect(await staffMetadata("admin", "Reports")).toEqual({ title: "Page not found", robots });
    await signedInAs(request, "acc-admin");
    expect(await staffMetadata("admin", "Reports")).toEqual({ title: "Reports", robots });
  });
});

describe("a staff action's first line (C4/C5 plan decision 4)", () => {
  it("sends a signed-out visitor to sign in", async () => {
    expect(await redirectOf(() => requireStaffAction("admin", "/admin/reports"))).toBe("/login?next=%2Fadmin%2Freports");
  });

  it("gives a student the 404", async () => {
    await signedInAs(request, "acc-student");
    await expect(requireStaffAction("admin", "/admin")).rejects.toThrow("notFound");
  });

  it("gives an admin their account", async () => {
    await signedInAs(request, "acc-admin");
    expect((await requireStaffAction("admin", "/admin")).id).toBe("acc-admin");
  });

  it("re-checks the session first: a session Supabase has ended goes to sign in before any role is looked at", async () => {
    await signedInAs(request, "acc-student");
    live.check = async (nextPath) => {
      throw new RedirectSignal(`/login?next=${encodeURIComponent(nextPath)}`, undefined);
    };
    expect(await redirectOf(() => requireStaffAction("admin", "/admin"))).toBe("/login?next=%2Fadmin");
  });
});

describe("orNotFound (C4/C5 plan decision 4)", () => {
  it("passes a staff function's answer through", async () => {
    expect(await orNotFound(Promise.resolve("changed"))).toBe("changed");
  });

  it("turns the database's forbidden (the role went after the check) into the 404", async () => {
    await expect(orNotFound(Promise.reject(new Refused("forbidden")))).rejects.toThrow("notFound");
  });

  it("and rethrows anything else, another refusal and a redirect included", async () => {
    const own = new Refused("own-shop");
    await expect(orNotFound(Promise.reject(own))).rejects.toBe(own);
    const redirect = new RedirectSignal("/", "replace");
    await expect(orNotFound(Promise.reject(redirect))).rejects.toBe(redirect);
  });
});

// A source check (C4/C5 plan Task 12, decision 4, amendment 10): every exported staff action's first await is
// requireStaffAction, directly or through a local helper whose first await it is (mentoredFrom, setRetired); the
// student's Hub actions keep requireAccount.
describe("every staff action starts with requireStaffAction (C4/C5 plan Task 12)", () => {
  for (const path of staffActionFiles()) {
    it(path, () => {
      const file = parse(path);
      const functions = functionsIn(file);
      const gate = path === "lib/hub-actions.ts" ? "requireAccount" : "requireStaffAction";
      const exported = [...functions.values()].filter(isExported);
      expect(exported.length).toBeGreaterThan(0);
      const wrong = exported
        .map((declaration) => ({ name: declaration.name!.text, first: firstGate(declaration, functions) }))
        .filter((action) => action.first !== gate);
      expect(wrong).toEqual([]);
    });
  }
});
