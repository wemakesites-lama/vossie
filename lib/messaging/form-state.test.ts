import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readFormState, writeFormState } from "@/lib/auth/form-state";
import { hashToken } from "@/lib/auth/secrets";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore } from "@/lib/data/store";
import { resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { clearOwnFormState, takeSentNote } from "./form-state";
import { sentNoteKey } from "./paths";

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
    accountId: "acc-student",
    createdAt: NOW,
    expiresAt: new Date("2026-11-13T08:42:00.000Z"),
  });
  request.cookies.set(SESSION_COOKIE, "token-1");
});

describe("messaging's form state (D decision 3, plan decision 7)", () => {
  it("says \"Sent.\" once: the thread takes the note as it reads it", async () => {
    await writeFormState(sentNoteKey("conv-s1"), { errors: [], values: {}, notice: "sent" }, NOW);
    expect(await takeSentNote("conv-s1")).toBe(true);
    expect(await takeSentNote("conv-s1")).toBe(false);
    expect(await takeSentNote("conv-s2")).toBe(false);
  });

  it("clears one form's state for this browser's session, and does nothing signed out", async () => {
    await writeFormState("reply:conv-s1", { errors: ["message-missing"], values: {}, notice: null }, NOW);
    await clearOwnFormState("reply:conv-s1");
    expect(await readFormState("reply:conv-s1")).toBeNull();
    resetRequest(request);
    await clearOwnFormState("reply:conv-s1");
  });
});
