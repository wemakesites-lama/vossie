import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveFormState } from "@/lib/data/form-states";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { takeListingToken } from "@/lib/selling/form-state";
import { ListingForm } from "./ListingForm";

const viewer = vi.hoisted(() => ({ id: null as string | null, sessionKey: null as string | null }));

vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/auth/session", async () => {
  const { getAccount } = await import("@/lib/data/accounts");
  const { redirect } = await import("next/navigation");
  const { signInHref } = await import("@/lib/next-path");
  const getViewer = async () => (viewer.id ? getAccount(viewer.id) : null);
  return {
    getViewer,
    getSessionKey: async () => viewer.sessionKey,
    requireAccount: async (next: string) => (await getViewer()) ?? redirect(signInHref(next)),
  };
});
vi.mock("@/lib/selling/listing-actions", () => ({ saveListingForm: async () => {} }));

const tokens = () => [...document.querySelectorAll<HTMLInputElement>('input[name="photo"]')].map((input) => input.value);
const editing = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  resetSampleStore();
  viewer.id = "acc-seller";
  viewer.sessionKey = null;
});

describe("the listing form's request-time part (selling spec 2.10 and section 3)", () => {
  it("starts a new listing as an item, for cash, at the shop's first pickup point", async () => {
    render(await ListingForm({}));
    expect(screen.getByRole("radio", { name: "An item" })).toBeChecked();
    expect(screen.getByLabelText("Pickup point")).toHaveValue("pp-midrand-library");
    expect(screen.getByRole("button", { name: "Save and publish" })).toBeInTheDocument();
  });

  it("fills the form from one of the seller's listings, its photos and their descriptions too", async () => {
    render(await ListingForm(editing("l-001")));
    expect(screen.getByLabelText("Title")).toHaveValue("Casio fx-991ZA Plus calculator");
    expect(screen.getByLabelText("Price in rand")).toHaveValue("250");
    expect(tokens()).toEqual(["/stock/listing/tech.jpg", "/placeholders/photo/2.svg", "/placeholders/photo/3.svg"]);
    expect(screen.getByRole("textbox", { name: "Describe photo 2" })).toHaveValue(
      "The back of the calculator, with the battery cover",
    );
  });

  it("shows what was typed after a failed save, with its errors", async () => {
    viewer.sessionKey = "session-1";
    await saveFormState(
      {
        sessionKey: "session-1",
        form: "listing:l-001",
        errors: ["title-missing"],
        values: { kind: "item", title: "", photos: "/placeholders/photo/3.svg" },
        notice: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      new Date(),
    );
    render(await ListingForm(editing("l-001")));
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByRole("link", { name: "Give your listing a title." })).toHaveAttribute("href", "#edit-l-001-title");
    expect(tokens()).toEqual(["/placeholders/photo/3.svg"]);
  });

  it("shows a too-long description where it is: linked, marked invalid, and its message by the photos (amendment 11.5)", async () => {
    viewer.sessionKey = "session-1";
    const long = "x".repeat(126);
    await saveFormState(
      {
        sessionKey: "session-1",
        form: "listing:l-001",
        errors: ["alt-length"],
        values: {
          kind: "item",
          photos: ["/placeholders/photo/2.svg", "/placeholders/photo/3.svg", "/placeholders/photo/4.svg"].join("\n"),
          "alt:/placeholders/photo/2.svg": "Fine",
          "alt:/placeholders/photo/3.svg": long,
          "alt:/placeholders/photo/4.svg": long,
        },
        notice: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      new Date(),
    );
    render(await ListingForm(editing("l-001")));
    const message = "Keep each photo's description to 125 characters.";
    expect(screen.getByRole("link", { name: message })).toHaveAttribute("href", "#edit-l-001-alt-2");
    const second = screen.getByRole("textbox", { name: "Describe photo 2" });
    expect(second).toHaveAttribute("id", "edit-l-001-alt-2");
    expect(second).toHaveAttribute("aria-invalid", "true");
    // Described by the hint and the error (amendment 13.4).
    expect(second).toHaveAccessibleDescription(/can't see it\. Error: Keep each photo's description to 125 characters\.$/);
    expect(screen.getByRole("textbox", { name: "Describe photo 3" })).toHaveAccessibleDescription(/can't see it\.$/);
    // Only the first one is marked, where the link lands; the file input isn't.
    expect(screen.getByRole("textbox", { name: "Describe photo 1" })).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("textbox", { name: "Describe photo 3" })).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Add photos")).not.toHaveAttribute("aria-invalid");
    expect(document.getElementById("edit-l-001-alt-error")).toHaveTextContent(message);
    expect(document.getElementById("edit-l-001-photos-error")).toBeNull();
  });

  it("gives a new listing's form a one-time token, kept for the session, and a different one each time (amendment 14.1)", async () => {
    viewer.sessionKey = "session-1";
    const tokenOnPage = () => document.querySelector<HTMLInputElement>('input[name="once"]')!.value;
    const { unmount } = render(await ListingForm({}));
    const first = tokenOnPage();
    expect(document.querySelector('input[name="once"]')).toHaveAttribute("type", "hidden");
    unmount();
    render(await ListingForm({}));
    const second = tokenOnPage();
    expect(second).not.toBe(first);
    // Both are the session's to take, once.
    expect(await takeListingToken(first, new Date())).toEqual({ kind: "first" });
    expect(await takeListingToken(first, new Date())).toMatchObject({ kind: "again" });
    expect(await takeListingToken(second, new Date())).toEqual({ kind: "first" });
  });

  it("gives an edit form no token", async () => {
    viewer.sessionKey = "session-1";
    render(await ListingForm(editing("l-001")));
    expect(document.querySelector('input[name="once"]')).toBeNull();
    expect([...sampleStore().formStates.keys()]).toEqual([]);
  });

  it("is a 404 for another shop's listing", async () => {
    await expect(ListingForm(editing("l-004"))).rejects.toThrow("notFound");
  });
});
