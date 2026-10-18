import { describe, expect, it } from "vitest";
import {
  backPathFor,
  composerFormKey,
  composerPath,
  inboxPath,
  isId,
  parseInboxTab,
  parseReportTarget,
  replyFormKey,
  reportFormKey,
  reportPath,
  reportSentPath,
  sentNoteKey,
  targetPath,
  threadPath,
} from "./paths";

describe("messaging addresses (messaging spec 2.1, 2.8 and 3)", () => {
  it("builds the composer's, a thread's and the inbox's addresses", () => {
    expect(composerPath({ kind: "listing", listingId: "l-001" })).toBe("/listings/l-001/message");
    expect(composerPath({ kind: "shop", sellerSlug: "tech-corner" })).toBe("/sellers/tech-corner/message");
    expect(threadPath("conv-s1")).toBe("/messages/conv-s1");
    expect(inboxPath("buying")).toBe("/messages");
    expect(inboxPath("selling")).toBe("/messages?tab=selling");
  });

  it("reads the inbox's tab, Buying unless it says selling (spec 2.10)", () => {
    expect(parseInboxTab("selling")).toBe("selling");
    expect(parseInboxTab(["selling", "buying"])).toBe("selling");
    for (const raw of [undefined, "", "Selling", "sold"]) expect(parseInboxTab(raw), String(raw)).toBe("buying");
  });

  it("builds the report form's, the thank-you's and the target's addresses", () => {
    const target = { kind: "request", id: "r-001" } as const;
    expect(reportPath(target)).toBe("/report?request=r-001");
    expect(reportSentPath(target)).toBe("/report/sent?request=r-001");
    expect(targetPath({ kind: "listing", id: "l-001" })).toBe("/listings/l-001");
    expect(targetPath({ kind: "seller", id: "tech-corner" })).toBe("/sellers/tech-corner");
    expect(targetPath(target)).toBe("/looking-for/r-001");
  });

  it("reads one report target from the address", () => {
    expect(parseReportTarget({ listing: "l-001" })).toEqual({ kind: "listing", id: "l-001" });
    expect(parseReportTarget({ seller: ["tech-corner"] })).toEqual({ kind: "seller", id: "tech-corner" });
  });

  it("refuses no target, two targets and ids this site never makes", () => {
    for (const params of [
      {},
      { listing: "l-001", seller: "tech-corner" },
      { listing: "" },
      { listing: "../admin" },
      { listing: "L-001" },
      { request: "r 001" },
      { listing: `l-${"1".repeat(90)}` },
    ]) {
      expect(parseReportTarget(params), JSON.stringify(params)).toBeNull();
    }
    expect(isId("conv-0b6c1f1e-7c43-4d8f-9a55-3f3a0b0c0d0e")).toBe(true);
    expect(isId("conv-s1/../x")).toBe(false);
  });

  it("sends the sign-in page's back link to the page behind a composer or a report (plan decision 4)", () => {
    expect(backPathFor("/listings/l-001/message")).toBe("/listings/l-001");
    expect(backPathFor("/sellers/tech-corner/message")).toBe("/sellers/tech-corner");
    expect(backPathFor("/report?listing=l-001")).toBe("/listings/l-001");
    expect(backPathFor("/report?seller=tech-corner")).toBe("/sellers/tech-corner");
    expect(backPathFor("/report?request=r-001")).toBe("/looking-for/r-001");
    expect(backPathFor("/report?listing=../x")).toBeNull();
  });

  it("gives no back link for pages that need an account, and keeps every other path", () => {
    for (const next of ["/account", "/account/privacy", "/messages", "/messages/conv-s1", "/notifications"]) {
      expect(backPathFor(next), next).toBeNull();
    }
    expect(backPathFor("/listings/l-001")).toBe("/listings/l-001");
    expect(backPathFor("/browse?cat=tech")).toBe("/browse?cat=tech");
    expect(backPathFor("/messages-old")).toBe("/messages-old");
  });

  it("gives staff pages no back link, and a slot request page its post (staff tools plan, Task 15)", () => {
    for (const next of ["/admin", "/admin/reports/rep-1", "/mentor/tech-corner", "/hub/manage", "/hub/new", "/hub/h-002/edit"]) {
      expect(backPathFor(next), next).toBeNull();
    }
    expect(backPathFor("/hub/h-002/book")).toBe("/hub/h-002");
    expect(backPathFor("/hub/h-002")).toBe("/hub/h-002");
  });

  it("keys each form's state by what it's about, so two drafts never mix (D decision 3)", () => {
    const keys = [
      composerFormKey({ kind: "listing", listingId: "l-001" }),
      composerFormKey({ kind: "shop", sellerSlug: "l-001" }),
      replyFormKey("conv-s1"),
      sentNoteKey("conv-s1"),
      reportFormKey({ kind: "listing", id: "l-001" }),
      reportFormKey({ kind: "seller", id: "l-001" }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
