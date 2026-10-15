import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { countNewNotifications, notify } from "@/lib/data/notifications";
import { resetSampleStore } from "@/lib/data/store";
import { Notifications } from "./Notifications";

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount("acc-student"),
}));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T08:42:00.000Z"));
});

describe("notifications for this visitor (messaging spec 2.9)", () => {
  it("shows which were new on this visit, and marks them all read", async () => {
    render(await Notifications());
    expect(screen.getAllByText("New")).toHaveLength(2);
    expect(await countNewNotifications("acc-student")).toBe(0);
  });

  it("leaves everyone else's notifications unread", async () => {
    await notify({
      accountId: "acc-seller",
      kind: "message",
      subjectId: "conv-other",
      text: "Someone asked about something",
      href: "/messages/conv-other",
      now: new Date("2026-10-14T08:00:00.000Z"),
    });
    render(await Notifications());
    expect(await countNewNotifications("acc-seller")).toBe(1);
  });
});
