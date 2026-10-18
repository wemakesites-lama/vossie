import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormError } from "@/lib/auth/messages";
import { getMentoredShop, listNotes } from "@/lib/data/mentors";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { MentorShop } from "./MentorShop";

vi.mock("@/lib/staff/mentor-actions", () => ({ addMentorNote: async () => {}, addCheckIn: async () => {} }));

const NOW = new Date("2026-10-14T10:00:00.000Z");
const naledi = { id: "acc-mentor", roles: ["mentor"] as const };
type FormView = { values: Record<string, string>; errors: FormError[] };
const empty: FormView = { values: {}, errors: [] };

beforeEach(() => {
  resetSampleStore();
});

async function show(forms: { note?: FormView; checkIn?: FormView } = {}) {
  const shop = (await getMentoredShop("tech-corner", naledi, NOW))!;
  render(
    <MentorShop
      shop={shop}
      campusName="Midrand"
      notes={await listNotes(shop.ownerId)}
      noteForm={forms.note ?? empty}
      checkInForm={forms.checkIn ?? empty}
      today="2026-10-14"
    />,
  );
}

describe("a shop's mentor page (staff tools spec 2.6, plan decisions 15 and 16)", () => {
  it("shows the shop's numbers and says mentors see numbers, never messages", async () => {
    await show();
    const facts = screen.getByRole("region", { name: "This shop" });
    expect(within(facts).getByText("Sipho")).toBeInTheDocument();
    expect(within(facts).getByText("2 of 2")).toBeInTheDocument();
    expect(within(facts).getByText(/never their messages/)).toBeInTheDocument();
    expect(within(facts).getByText("No flags.")).toBeInTheDocument();
  });

  it("explains each flag", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    await show();
    expect(screen.getByText("Shop paused")).toBeInTheDocument();
    expect(screen.getByText("Buyers can't see the shop's listings until it's resumed.")).toBeInTheDocument();
  });

  it("lists the notes and check-ins, newest first, with who wrote them", async () => {
    await show();
    const notes = screen.getByRole("region", { name: "Notes and check-ins" });
    expect(notes).toHaveAttribute("id", "mentor-tech-corner-notes");
    const items = within(notes).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/^Note/);
    expect(items[0]).toHaveTextContent("Replies fast.");
    expect(items[1]).toHaveTextContent(/^Check-in on 6 October 2026/);
    expect(items[1]).toHaveTextContent("Naledi");
  });

  it("adds a note or a dated check-in, each saying who sees it, the buttons naming the shop", async () => {
    await show();
    expect(screen.getByLabelText("Note")).toHaveAccessibleDescription(
      "Only mentors and admins see it, never the seller. Up to 1,000 characters.",
    );
    expect(screen.getByRole("button", { name: "Add a note about Tech corner" })).toHaveAttribute("type", "submit");
    const day = screen.getByLabelText("Date of the check-in");
    expect(day).toHaveValue("2026-10-14");
    expect(day).toHaveAttribute("max", "2026-10-14");
    expect(screen.getByLabelText("What you talked about")).toBeRequired();
    expect(screen.getByRole("button", { name: "Add a check-in for Tech corner" })).toBeInTheDocument();
    for (const input of document.querySelectorAll('input[name="shop"]')) expect(input).toHaveValue("tech-corner");
  });

  it("keeps a failed note's words, with what's wrong", async () => {
    await show({
      note: { values: { text: "" }, errors: [{ message: "Write the note first.", fieldId: "note-tech-corner-text" }] },
    });
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveAttribute("aria-invalid", "true");
  });
});
