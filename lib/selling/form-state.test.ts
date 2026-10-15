import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState, writeFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { DASHBOARD_FORM, MY_LISTINGS_FORM, takeNotice } from "./form-state";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(async () => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await createSession({
    key: hashToken("token-1"),
    accountId: "acc-seller",
    createdAt: NOW,
    expiresAt: new Date("2026-11-13T08:42:00.000Z"),
  });
  request.cookies.set(SESSION_COOKIE, "token-1");
});

describe("selling's notices (amendment 10.6, as messaging takes its \"Sent.\" note)", () => {
  it("shows a notice once: the page takes it as it reads it, and only from its own form", async () => {
    await writeFormState(MY_LISTINGS_FORM, { errors: [], values: { listing: "l-001" }, notice: "paused" }, NOW);
    await writeFormState(DASHBOARD_FORM, { errors: [], values: {}, notice: "shop-resumed" }, NOW);
    expect(await takeNotice(MY_LISTINGS_FORM)).toMatchObject({ notice: "paused", values: { listing: "l-001" } });
    expect(await takeNotice(MY_LISTINGS_FORM)).toBeNull();
    expect(await readFormState(MY_LISTINGS_FORM)).toBeNull();
    // The dashboard's was not taken with it.
    expect(await takeNotice(DASHBOARD_FORM)).toMatchObject({ notice: "shop-resumed" });
    expect(await takeNotice(DASHBOARD_FORM)).toBeNull();
  });

  it("leaves a state that holds no notice alone, and finds nothing when signed out", async () => {
    await writeFormState(DASHBOARD_FORM, { errors: ["x"], values: {}, notice: null }, NOW);
    expect(await takeNotice(DASHBOARD_FORM)).toBeNull();
    expect((await readFormState(DASHBOARD_FORM))?.errors).toEqual(["x"]);
    resetRequest(request);
    expect(await takeNotice(DASHBOARD_FORM)).toBeNull();
  });
});
