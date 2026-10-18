import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHubPost } from "@/lib/data";
import { latestBooking } from "@/lib/data/hub-posts";
import { resetSampleStore } from "@/lib/data/store";
import type { HubBooking } from "@/lib/types";
import { BookSlotView } from "./BookSlot";

vi.mock("@/lib/hub-actions", () => ({ sendSlotRequest: async () => {} }));

beforeEach(() => {
  resetSampleStore();
});

async function show(overrides: Partial<Parameters<typeof BookSlotView>[0]> = {}) {
  const post = (await getHubPost("h-002"))!;
  render(<BookSlotView post={post} passed={false} latest={null} values={{}} errors={[]} notice={null} {...overrides} />);
}

describe("Request a slot (staff tools spec 2.5, plan decision 13)", () => {
  it("asks what they'd like help with and a time that suits, for these office hours", async () => {
    await show();
    expect(screen.getByRole("link", { name: "Back to Office hours: pricing your hustle" })).toHaveAttribute("href", "/hub/h-002");
    expect(screen.getByRole("heading", { level: 1, name: "Request a slot" })).toBeInTheDocument();
    expect(screen.getByText(/Thu 15 Oct · 13:00/)).toBeInTheDocument();
    const help = screen.getByLabelText("What you'd like help with");
    expect(help).toBeRequired();
    expect(help).toHaveAccessibleDescription("Up to 300 characters.");
    expect(screen.getByLabelText("A time that suits (optional)")).toHaveAccessibleDescription(
      "Up to 100 characters, like After 13:30.",
    );
    expect(screen.getByRole("button", { name: "Send request" })).toHaveAttribute("type", "submit");
    expect(document.querySelector('input[name="post"]')).toHaveValue("h-002");
  });

  it("shows where an open request stands instead of the form", async () => {
    const latest = await latestBooking("h-007", "acc-student");
    await show({ latest });
    expect(screen.getByRole("region", { name: "Your request" })).toHaveTextContent("Waiting for a mentor.");
    expect(screen.getByText(/write the listing or what to charge/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says when a mentor accepted it", async () => {
    const latest = { ...(await latestBooking("h-007", "acc-student"))!, status: "accepted" } satisfies HubBooking;
    await show({ latest });
    expect(screen.getByRole("region", { name: "Your request" })).toHaveTextContent("A mentor accepted it. See you there.");
  });

  it("offers the form again after a decline", async () => {
    const latest = { ...(await latestBooking("h-007", "acc-student"))!, status: "declined" } satisfies HubBooking;
    await show({ latest });
    expect(screen.getByText("A mentor couldn't fit in your last request. You can ask again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send request" })).toBeInTheDocument();
  });

  it("says when the office hours have passed, with no form", async () => {
    await show({ passed: true });
    expect(screen.getByText("These office hours have passed")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps what was typed and says what's wrong, and shows the last action's notice", async () => {
    await show({
      values: { help: "", time: "Mornings" },
      errors: [{ message: "Say what you'd like help with.", fieldId: "book-h-002-help" }],
      notice: "Request sent. A mentor will answer in your notifications.",
    });
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("What you'd like help with")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("A time that suits (optional)")).toHaveValue("Mornings");
    expect(screen.getByRole("status")).toHaveTextContent("Request sent.");
  });
});
