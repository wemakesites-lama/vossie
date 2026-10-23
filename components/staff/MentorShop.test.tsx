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

const NOTE_ONCE = "6f1c2a3e-8c1b-4d6e-9a43-0f6f1b3a9e55";
const CHECK_IN_ONCE = "0b9d6a1c-2f4e-4c7a-8d15-3e2a7c9b1f60";

async function show(forms: { note?: FormView; checkIn?: FormView; noteOnce?: string | null; checkInOnce?: string | null } = {}) {
  const shop = (await getMentoredShop("tech-corner", naledi, NOW))!;
  render(
    <MentorShop
      shop={shop}
      campusName="Midrand"
      notes={await listNotes(shop.ownerId)}
      noteForm={forms.note ?? empty}
      checkInForm={forms.checkIn ?? empty}
      noteOnce={forms.noteOnce === undefined ? NOTE_ONCE : forms.noteOnce}
      checkInOnce={forms.checkInOnce === undefined ? CHECK_IN_ONCE : forms.checkInOnce}
      today="2026-10-14"
      previous={{ enquiries: 0, salesConfirmed: 0 }}
      now={NOW}
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

  it("explains each flag, and says whose pause it is", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    await show();
    expect(screen.getByText("Paused by the seller", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("Paused by the seller", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("The seller paused the shop, so buyers can't see its listings until they resume it.")).toBeInTheDocument();
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

  it("gives the note form and the check-in form a one-time token each, so neither is made twice (amendment 15.7)", async () => {
    await show();
    const forms = document.querySelectorAll("form");
    expect(forms).toHaveLength(2);
    expect(forms[0].querySelector('input[name="once"]')).toHaveValue(NOTE_ONCE);
    expect(forms[1].querySelector('input[name="once"]')).toHaveValue(CHECK_IN_ONCE);
    expect(forms[0].querySelector('input[name="once"]')).toHaveAttribute("type", "hidden");
  });

  it("posts no token when none could be made", async () => {
    await show({ noteOnce: null, checkInOnce: null });
    expect(document.querySelector('input[name="once"]')).toBeNull();
  });

  it("links the shop's storefront, but not while the Hub has it paused (amendment 15.5)", async () => {
    await show();
    expect(screen.getByRole("link", { name: "See Tech corner's storefront" })).toHaveAttribute("href", "/sellers/tech-corner");
    expect(screen.queryByText(/The Hub has paused/)).toBeNull();
  });

  it("keeps the storefront link for a shop its seller paused", async () => {
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "seller" });
    await show();
    expect(screen.getByRole("link", { name: "See Tech corner's storefront" })).toBeInTheDocument();
    expect(screen.queryByText(/The Hub has paused/)).toBeNull();
  });

  it("says the Hub has paused a shop instead of linking a storefront that buyers get the 404 for (amendment 15.5)", async () => {
    Object.assign(sampleStore().sellerProfiles.get("acc-seller")!, { status: "paused", pausedBy: "staff" });
    await show();
    expect(screen.queryByRole("link", { name: /storefront/ })).toBeNull();
    expect(screen.getByText(/The Hub has paused Tech corner, so buyers can't see it\./)).toBeInTheDocument();
    // The numbers and the notes are still there to read.
    expect(screen.getByRole("region", { name: "Notes and check-ins" })).toBeInTheDocument();
  });

  it("keeps a failed note's words, with what's wrong", async () => {
    await show({
      note: { values: { text: "" }, errors: [{ message: "Write the note first.", fieldId: "note-tech-corner-text" }] },
    });
    expect(screen.getByRole("alert", { name: "There's a problem" })).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toHaveAttribute("aria-invalid", "true");
  });
});
