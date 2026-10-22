import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { OpenThread } from "./OpenThread";

const session = vi.hoisted(() => ({ accountId: "acc-student", sent: false }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async () => (await import("@/lib/data/accounts")).getAccount(session.accountId),
}));
vi.mock("@/lib/auth/form-state", () => ({ readFormState: async () => null }));
vi.mock("@/lib/messaging/form-state", () => ({ takeSentNote: async () => session.sent }));
vi.mock("@/lib/messaging/actions", () => ({
  confirmTheSale: async () => {},
  markAsCompleted: async () => {},
  saleDidntHappen: async () => {},
  sendReply: async () => {},
}));
vi.mock("@/lib/selling/listing-actions", () => ({ changeListingState: async () => {} }));
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());

const NOW = new Date("2026-10-14T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  session.accountId = "acc-student";
  session.sent = false;
});

describe("a thread for this visitor (messaging spec 3.3)", () => {
  it("shows the buyer the thread, marks it read, and says Sent. when the composer left it", async () => {
    session.sent = true;
    render(await OpenThread({ id: "conv-s1" }));
    expect(screen.getByRole("heading", { level: 1, name: "Messages with Tech corner" })).toBeInTheDocument();
    expect(screen.getByText("Midrand", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Sent.");
    expect(sampleStore().messages.get("msg-s2")?.readAt).toBe(NOW.toISOString());
    expect(sampleStore().notifications.get("note-s1")?.readAt).toBe(NOW.toISOString());
  });

  it("is the 404 for anyone but the buyer and the seller, and for an id that doesn't exist (spec 3.3)", async () => {
    session.accountId = "acc-mentor";
    await expect(OpenThread({ id: "conv-s1" })).rejects.toThrow("notFound");
    session.accountId = "acc-student";
    await expect(OpenThread({ id: "conv-nope" })).rejects.toThrow("notFound");
    expect(sampleStore().messages.get("msg-s2")?.readAt).toBeNull();
  });

  it("offers the seller Mark {title} as sold once the sale is completed and the listing is still up (role views N2)", async () => {
    session.accountId = "acc-seller";
    render(await OpenThread({ id: "conv-s2" }));
    const form = screen.getByRole("button", { name: "Mark Casio fx-991ZA Plus calculator as sold" }).closest("form")!;
    expect(form.querySelector('input[name="listing"]')).toHaveValue("l-001");
    expect(form.querySelector('input[name="to"]')).toHaveValue("sold");
    expect(form.querySelector('input[name="thread"]')).toHaveValue("conv-s2");
  });

  it("never offers it to the buyer, nor once the listing is sold", async () => {
    const buyer = render(await OpenThread({ id: "conv-s2" }));
    expect(screen.queryByRole("button", { name: /as sold$/ })).toBeNull();
    buyer.unmount();
    sampleStore().listings.get("l-001")!.state = "sold";
    session.accountId = "acc-seller";
    render(await OpenThread({ id: "conv-s2" }));
    expect(screen.queryByRole("button", { name: /as sold$/ })).toBeNull();
  });
});
