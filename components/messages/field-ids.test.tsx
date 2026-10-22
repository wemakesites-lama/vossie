import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormStateRow } from "@/lib/data/rows";
import type { MessageTarget } from "@/lib/messaging/paths";
import { composerSubject } from "@/lib/messaging/subjects";
import type { ReportTarget } from "@/lib/types";
import { makeThread } from "@/tests/helpers/fakes";
import { composerForm, ComposerView } from "./ComposerView";
import { reportForm, ReportView } from "./ReportView";
import { replyForm, ThreadView } from "./ThreadView";

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/messaging/actions", () => ({
  confirmTheSale: async () => {},
  markAsCompleted: async () => {},
  saleDidntHappen: async () => {},
  sendFirstMessage: async () => {},
  sendReply: async () => {},
  sendReport: async () => {},
}));
vi.mock("@/lib/selling/listing-actions", () => ({ changeListingState: async () => {} }));

// Messaging plan amendment 5. Next keeps the last pages hidden in the DOM, so two composers (for two listings) or two
// threads can be there at once. A <label for>, an error summary's "#field" link and an aria-describedby all go to the
// *first* element with that id, which may sit on the hidden page. So every field's id ends with the item it belongs to,
// and each reference must find an element inside its own view.

type Reference = { how: string; id: string };

/** Every id a view's labels, error-summary links and aria-describedby point to. */
function referencesIn(view: HTMLElement): Reference[] {
  const references: Reference[] = [];
  for (const label of view.querySelectorAll("label[for]")) {
    references.push({ how: "label for", id: label.getAttribute("for") ?? "" });
  }
  for (const link of view.querySelectorAll('a[href^="#"]')) {
    references.push({ how: "link", id: (link.getAttribute("href") ?? "").slice(1) });
  }
  for (const element of view.querySelectorAll("[aria-describedby]")) {
    for (const id of (element.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)) {
      references.push({ how: "aria-describedby", id });
    }
  }
  return references;
}

/** The references that find nothing, or find an element outside the view (what the browser finds is the first match). */
function strays(view: HTMLElement): string[] {
  return referencesIn(view).flatMap(({ how, id }) => {
    const found = document.getElementById(id);
    return found && view.contains(found) ? [] : [`${how} #${id}`];
  });
}

const state = (form: string, fields: Partial<FormStateRow>): FormStateRow => ({
  key: `s:${form}`,
  sessionKey: "s",
  form,
  errors: [],
  values: {},
  notice: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...fields,
});

async function showComposer(target: MessageTarget) {
  const subject = (await composerSubject(target))!;
  // Both fields fail where there are two; a cash-only listing and a shop's question have no swap field to fail.
  const errors = subject.swaps ? ["message-missing", "swap-length"] : ["message-missing"];
  const form = composerForm(state("composer", { errors, values: { body: "", swapOffer: "x".repeat(201) } }), target);
  return render(<ComposerView subject={subject} status={{ kind: "open" }} form={form} />);
}

describe("the composer's field ids (messaging plan amendment 5)", () => {
  it("ends each id with its listing or shop, so two kept composers never share one", async () => {
    const views = [
      await showComposer({ kind: "listing", listingId: "l-007" }),
      await showComposer({ kind: "listing", listingId: "l-028" }),
      await showComposer({ kind: "listing", listingId: "l-001" }),
      await showComposer({ kind: "shop", sellerSlug: "tech-corner" }),
    ].map((view) => view.container);
    for (const view of views) {
      expect(strays(view)).toEqual([]);
      // Not a pass for want of anything to check: every label, hint and error is there to be followed.
      expect(view.querySelectorAll("label[for]").length).toBeGreaterThanOrEqual(1);
      expect(view.querySelectorAll('a[href^="#"]').length).toBeGreaterThanOrEqual(1);
      expect(view.querySelectorAll("[aria-describedby]").length).toBeGreaterThanOrEqual(1);
    }
    // Both fields of a swap listing are checked (the cash-only listing and the shop have no swap field).
    expect(referencesIn(views[0]).map((reference) => reference.id)).toEqual(
      expect.arrayContaining([
        "composer-message-l-007",
        "composer-swap-l-007",
        "composer-message-l-007-hint",
        "composer-message-l-007-error",
        "composer-swap-l-007-hint",
        "composer-swap-l-007-error",
      ]),
    );
    expect(referencesIn(views[3]).map((reference) => reference.id)).toContain("composer-message-tech-corner");
    // And each view's own ids are its own: none repeats across the four.
    const ids = [...document.querySelectorAll("textarea")].map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the composer's safety tips ids (community actions plan amendment 19.9)", () => {
  it("gives each composer's tips heading an id of its own, so two kept composers never share one", async () => {
    const views = [
      await showComposer({ kind: "listing", listingId: "l-007" }),
      await showComposer({ kind: "listing", listingId: "l-028" }),
      await showComposer({ kind: "shop", sellerSlug: "tech-corner" }),
    ].map((view) => view.container);
    const ids = views.map((view) => view.querySelector(".msg-tips h2")?.id);
    expect(ids).toEqual([
      "composer-l-007-tips-title",
      "composer-l-028-tips-title",
      "composer-tech-corner-tips-title",
    ]);
    // Each section is named by the heading in its own view, and no heading id is on the page twice.
    for (const [index, view] of views.entries()) {
      expect(view.querySelector(".msg-tips")?.getAttribute("aria-labelledby")).toBe(ids[index]);
      expect(document.querySelectorAll(`[id="${ids[index]}"]`)).toHaveLength(1);
    }
  });
});

describe("the thread's field ids (messaging plan amendment 5)", () => {
  function showThread(id: string) {
    const reply = replyForm(state("reply", { errors: ["message-missing"], values: { body: "" } }), id);
    return render(
      <ThreadView
        thread={makeThread({ id })}
        now={new Date("2026-10-14T13:00:00Z")}
        reply={reply}
        sent={false}
        campusName="Midrand"
      />,
    );
  }

  it("ends each id with its conversation, so two kept threads never share one", () => {
    const views = [showThread("conv-s1"), showThread("conv-s2")].map((view) => view.container);
    for (const view of views) {
      expect(strays(view)).toEqual([]);
      expect(view.querySelectorAll("label[for]")).toHaveLength(1);
      expect(view.querySelectorAll('a[href^="#"]')).toHaveLength(1);
      expect(view.querySelectorAll("[aria-describedby]")).toHaveLength(1);
    }
    expect(referencesIn(views[0]).map((reference) => reference.id)).toEqual(
      expect.arrayContaining(["thread-reply-conv-s1", "thread-reply-conv-s1-hint", "thread-reply-conv-s1-error"]),
    );
    expect(referencesIn(views[1]).map((reference) => reference.id)).toContain("thread-reply-conv-s2");
  });
});

describe("the report form's field ids (messaging plan amendment 5)", () => {
  function showReport(target: ReportTarget, title: string) {
    const form = reportForm(
      state("report", { errors: ["reason-missing", "detail-length"], values: { detail: "z".repeat(501) } }),
      target,
    );
    return render(
      <ReportView target={target} subject={{ title, href: "/", backLabel: "Back" }} already={false} form={form} />,
    );
  }

  it("starts each id with what's reported, so two kept report forms never share one", () => {
    const views = [
      showReport({ kind: "listing", id: "l-001" }, "Casio fx-991ZA Plus calculator"),
      showReport({ kind: "listing", id: "l-007" }, "Gaming headset, barely used"),
      showReport({ kind: "seller", id: "tech-corner" }, "Tech corner"),
      // A seller whose slug is a listing's id: the kind in front keeps their ids apart.
      showReport({ kind: "seller", id: "l-001" }, "A shop called L 001"),
      showReport({ kind: "request", id: "r-001" }, "Accounting 1 tutor this week"),
    ].map((view) => view.container);
    for (const view of views) {
      expect(strays(view)).toEqual([]);
      // Seven radio buttons' labels and the detail's, the two summary links, the group's and the detail's descriptions.
      expect(view.querySelectorAll("label[for]")).toHaveLength(8);
      expect(view.querySelectorAll('a[href^="#"]')).toHaveLength(2);
      expect(view.querySelectorAll("[aria-describedby]").length).toBeGreaterThanOrEqual(2);
    }
    expect(referencesIn(views[3]).map((reference) => reference.id)).toEqual(
      expect.arrayContaining([
        "report-reason-seller-l-001-scam",
        "report-reason-seller-l-001-other",
        "report-reason-seller-l-001-error",
        "report-detail-seller-l-001",
        "report-detail-seller-l-001-hint",
        "report-detail-seller-l-001-error",
      ]),
    );
    // No field's id repeats across the five forms. (A summary's id is per form, so the five share "report-summary":
    // each hidden copy has the same words, as a section heading does.)
    const ids = [...document.querySelectorAll("input[id], textarea[id]")].map((field) => field.id);
    expect(ids).toHaveLength(5 * 8);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
