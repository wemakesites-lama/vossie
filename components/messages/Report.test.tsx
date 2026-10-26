import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReport } from "@/lib/data/reports";
import { resetSampleStore } from "@/lib/data/store";
import { Report } from "./Report";

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount("acc-mentor"),
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("@/lib/messaging/actions", () => ({ sendReport: async () => {} }));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());

beforeEach(() => {
  resetSampleStore();
});

describe("the report form for this visitor (messaging spec 3.4)", () => {
  it("shows the form, or says the visitor has reported it already", async () => {
    const target = { kind: "listing", id: "l-001" } as const;
    const { unmount } = render(await Report({ target }));
    expect(screen.getByRole("button", { name: "Send report" })).toBeInTheDocument();
    unmount();
    await createReport({
      reporterId: "acc-mentor",
      target,
      targetTitle: "Casio fx-991ZA Plus calculator",
      reason: "spam",
      detail: "",
      now: new Date("2026-10-14T08:42:00.000Z"),
    });
    render(await Report({ target }));
    expect(screen.getByText(/^You've reported this listing already\./)).toBeInTheDocument();
  });

  it("is the 404 for something that doesn't exist", async () => {
    await expect(Report({ target: { kind: "listing", id: "l-nope" } })).rejects.toThrow("notFound");
    await expect(Report({ target: { kind: "seller", id: "nope" } })).rejects.toThrow("notFound");
    await expect(Report({ target: { kind: "request", id: "r-nope" } })).rejects.toThrow("notFound");
  });

  it("reports a seller and a request too", async () => {
    const { unmount } = render(await Report({ target: { kind: "seller", id: "tech-corner" } }));
    expect(screen.getByRole("heading", { level: 1, name: "Report this seller" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Back to / })).toHaveAttribute("href", "/sellers/tech-corner");
    unmount();
    render(await Report({ target: { kind: "request", id: "r-001" } }));
    expect(screen.getByRole("heading", { level: 1, name: "Report this request" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Back to / })).toHaveAttribute("href", "/looking-for/r-001");
  });
});
