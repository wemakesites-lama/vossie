import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { GET } from "./route";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

describe("the data export (accounts spec 3.3, plan decision 20)", () => {
  it("downloads the signed-in account's data as campuscart-data.json, never cached", async () => {
    await createSession({
      key: hashToken("token-1"),
      accountId: "acc-student",
      createdAt: NOW,
      expiresAt: new Date("2026-11-13T08:42:00.000Z"),
    });
    request.cookies.set(SESSION_COOKIE, "token-1");
    const response = await GET();
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="campuscart-data.json"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await response.json();
    expect(data).toMatchObject({
      exportedAt: NOW.toISOString(),
      account: { email: "student@eduvos.com", firstName: "Thandi", campus: "midrand" },
      consents: [{ policy: "2026-10-draft" }],
      sessions: [{ signedInAt: NOW.toISOString() }],
    });
    const text = JSON.stringify(data);
    expect(text).not.toContain("token-1");
    expect(text).not.toContain(hashToken("token-1"));
  });

  it("sends a signed-out visitor to sign in first", async () => {
    expect(await redirectOf(() => GET())).toBe("/login?next=%2Faccount%2Fprivacy");
  });
});
