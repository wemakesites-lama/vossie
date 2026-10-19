import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest, hideRequest, setRequestOpen } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { takeOnceToken } from "@/lib/staff/once";
import { RequestForm } from "./RequestForm";

const viewer = vi.hoisted(() => ({
  account: null as null | { id: string; campusSlug: string },
  sessionKey: "session-1" as string | null,
}));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async (next: string) => {
    if (!viewer.account) throw new Error(`sign in, then ${next}`);
    return viewer.account;
  },
  getSessionKey: async () => viewer.sessionKey,
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("@/lib/looking-for/actions", () => ({ saveMyRequest: async () => {}, reopenMyRequest: async () => {} }));

const NOW = new Date("2026-10-14T08:42:00.000Z");
const FIELDS = {
  title: "Desk lamp for res",
  categorySlug: "res-living",
  campusSlug: "pretoria",
  details: "A lamp that clips onto a desk, by the weekend.",
  budgetZar: 150,
  swapWelcome: false,
  neededBy: null,
};

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  viewer.account = null;
  viewer.sessionKey = "session-1";
});

describe("the request form for this visitor (community actions spec 2.3 and 2.6)", () => {
  it("starts a new request on the account's campus, with today's date limits in SAST", async () => {
    viewer.account = { id: "acc-student", campusSlug: "midrand" };
    render(await RequestForm({ requestId: null }));
    expect(screen.getByLabelText("Campus")).toHaveValue("midrand");
    expect(screen.getByLabelText("Needed by (optional)")).toHaveAttribute("min", "2026-10-14");
  });

  it("gives a new request a one-time token this session can take once, and no one else can (amendment 3)", async () => {
    viewer.account = { id: "acc-student", campusSlug: "midrand" };
    render(await RequestForm({ requestId: null }));
    const token = (document.querySelector('input[name="once"]') as HTMLInputElement).value;
    expect(token).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    // Another browser's session has no such token.
    viewer.sessionKey = "session-2";
    expect(await takeOnceToken(token, NOW)).toEqual({ kind: "none" });
    viewer.sessionKey = "session-1";
    expect(await takeOnceToken(token, NOW)).toEqual({ kind: "first" });
    expect(await takeOnceToken(token, NOW)).toMatchObject({ kind: "again" });
  });

  it("makes a new token each time the form is drawn", async () => {
    viewer.account = { id: "acc-student", campusSlug: "midrand" };
    const { unmount } = render(await RequestForm({ requestId: null }));
    const first = (document.querySelector('input[name="once"]') as HTMLInputElement).value;
    unmount();
    render(await RequestForm({ requestId: null }));
    expect((document.querySelector('input[name="once"]') as HTMLInputElement).value).not.toBe(first);
  });

  it("fills an edit with the asker's own request, with no token (an edit needs none)", async () => {
    viewer.account = { id: "acc-student", campusSlug: "midrand" };
    const { id } = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
    render(await RequestForm({ requestId: id }));
    expect(screen.getByLabelText("What you need")).toHaveValue("Desk lamp for res");
    expect(screen.getByLabelText("Campus")).toHaveValue("pretoria");
    expect(document.querySelector('input[name="once"]')).toBeNull();
  });

  it("is the 404 for someone else's request, a sample or an unknown id", async () => {
    const { id } = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
    viewer.account = { id: "acc-mentor", campusSlug: "midrand" };
    await expect(RequestForm({ requestId: id })).rejects.toThrow("notFound");
    await expect(RequestForm({ requestId: "r-001" })).rejects.toThrow("notFound");
    await expect(RequestForm({ requestId: "nope" })).rejects.toThrow("notFound");
  });

  it("says why a hidden request can't be changed", async () => {
    viewer.account = { id: "acc-student", campusSlug: "midrand" };
    const { id } = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
    await hideRequest(id, "Not allowed.", NOW);
    render(await RequestForm({ requestId: id }));
    expect(screen.getByText(/The Hub hid this request/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("says why a closed request can't be changed, and offers Reopen", async () => {
    viewer.account = { id: "acc-student", campusSlug: "midrand" };
    const { id } = await createRequest({ askerId: "acc-student", fields: FIELDS, now: NOW });
    await setRequestOpen("acc-student", id, false, NOW);
    render(await RequestForm({ requestId: id }));
    expect(screen.getByText("This request is closed. Reopen it to change it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen Desk lamp for res" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("sends a signed-out visitor to sign in, coming back to the form", async () => {
    await expect(RequestForm({ requestId: null })).rejects.toThrow("sign in, then /looking-for/new");
    await expect(RequestForm({ requestId: "r-abc" })).rejects.toThrow("sign in, then /looking-for/r-abc/edit");
  });
});
