import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { requireStaff, staffMetadata } from "./access";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
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
