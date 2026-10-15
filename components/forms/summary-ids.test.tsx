import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountView, detailsForm } from "@/components/account/AccountView";
import { PrivacySettingsView } from "@/components/account/PrivacySettingsView";
import { CodeStep, EmailStep, ProfileStep } from "@/components/auth/SignInSteps";
import { ComposerView } from "@/components/messages/ComposerView";
import { ReportView } from "@/components/messages/ReportView";
import { ThreadView } from "@/components/messages/ThreadView";
import { ListingFormView } from "@/components/sell/ListingFormView";
import { OnboardingView } from "@/components/sell/OnboardingView";
import { ShopProfileView } from "@/components/sell/ShopProfileView";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import { sampleSellerRows } from "@/data/fixtures/shops";
import { emptyDraft } from "@/lib/data/shops";
import { composerSubject } from "@/lib/messaging/subjects";
import type { Account } from "@/lib/types";
import { makeThread } from "@/tests/helpers/fakes";

// The forms only need something to post to; the actions have their own tests.
vi.mock("@/lib/auth/actions", () => ({
  cancelSignIn: async () => {},
  completeProfile: async () => {},
  deleteAccount: async () => {},
  resendCode: async () => {},
  signInAsSample: async () => {},
  signOut: async () => {},
  startSignIn: async () => {},
  updateDetails: async () => {},
  verifyCode: async () => {},
}));
vi.mock("@/lib/messaging/actions", () => ({
  confirmTheSale: async () => {},
  markAsCompleted: async () => {},
  saleDidntHappen: async () => {},
  sendFirstMessage: async () => {},
  sendReply: async () => {},
  sendReport: async () => {},
}));
vi.mock("@/lib/selling/shop-actions", () => ({
  saveOnboardingStep: async () => {},
  saveShopProfile: async () => {},
  sendForApproval: async () => {},
}));
vi.mock("@/lib/selling/listing-actions", () => ({ saveListingForm: async () => {} }));

const account: Account = {
  id: "acc-student",
  email: "student@eduvos.com",
  firstName: "Thandi",
  campusSlug: "midrand",
  roles: [],
  seller: null,
  createdAt: "2026-09-01T07:30:00.000Z",
};

const oops = [{ message: "Something is wrong.", fieldId: null }];

describe("error summary ids (accounts spec 6)", () => {
  // Next keeps the last pages hidden in the DOM, so the sign-in steps, the account page and the privacy settings page
  // can all be there together. Every id, and so every summary's, must be unique across them.
  it("never repeats an id when every form shows a summary at once", async () => {
    const subject = (await composerSubject({ kind: "listing", listingId: "l-007" }))!;
    render(
      <>
        <EmailStep next={null} email="" consented={false} errors={oops} samples={null} />
        <CodeStep next={null} maskedEmail="t•••@eduvos.com" errors={oops} resent={false} sampleCode={null} />
        <ProfileStep next={null} firstName="" campus="" campuses={campuses} errors={oops} />
        <AccountView
          account={account}
          campuses={campuses}
          details={{ ...detailsForm(account, null), errors: oops }}
          counts={{ conversations: 0, notifications: 0 }}
        />
        <PrivacySettingsView consent={null} deleteErrors={oops} reports={[]} />
        <ComposerView
          subject={subject}
          status={{ kind: "open" }}
          form={{ body: "", swapOffer: "", errors: oops, warnings: ["deposit"] }}
        />
        <ThreadView
          thread={makeThread()}
          now={new Date("2026-10-14T13:00:00Z")}
          reply={{ body: "", errors: oops, warnings: ["bank"] }}
          sent={false}
          campusName="Midrand"
        />
        <ReportView
          target={{ kind: "listing", id: "l-001" }}
          subject={{ title: "Casio fx-991ZA Plus calculator", href: "/listings/l-001", backLabel: "Back to the listing" }}
          already={false}
          form={{ reason: "", detail: "", errors: oops }}
        />
        {/* Each of the wizard's steps is its own page, so all five can be kept at once (selling plan decision 23). */}
        {([1, 2, 3, 4, 5] as const).map((step) => (
          <OnboardingView
            key={step}
            step={step}
            draft={{ ...emptyDraft("acc-student", "midrand", new Date("2026-10-14T08:00:00Z")), photoSrc: "/photos/ph-1" }}
            errors={oops}
            campuses={campuses}
            categories={categories}
            pickupPoints={pickupPoints}
          />
        ))}
        {/* A new listing and a listing being edited are pages of their own too (selling plan decision 23). */}
        {[null, "l-001"].map((listingId) => (
          <ListingFormView
            key={listingId ?? "new"}
            listingId={listingId}
            state={listingId ? "available" : null}
            waiting={false}
            values={{ kind: "item", payMode: "cash", handover: "pickup", pickup: "pp-midrand-library" }}
            photos={[{ src: "/placeholders/photo/2.svg", alt: "", thumb: "/placeholders/photo/2.svg" }]}
            errors={oops}
            categories={categories}
            spots={pickupPoints.filter((point) => point.campusSlug === "midrand")}
            campusName="Midrand"
          />
        ))}
        <ShopProfileView
          shop={sampleSellerRows.find((row) => row.slug === "tech-corner")!}
          status="approved"
          typed={null}
          errors={oops}
          notice={null}
          campuses={campuses}
          categories={categories}
          pickupPoints={pickupPoints}
          host="vossie.test"
        />
      </>,
    );
    const summaries = screen.getAllByRole("alert", { name: "There's a problem" });
    expect(summaries).toHaveLength(16);
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    expect(summaries.map((summary) => summary.id)).toEqual([
      "signin-email-summary",
      "signin-code-summary",
      "signin-profile-summary",
      "account-details-summary",
      "account-privacy-delete-summary",
      "composer-summary",
      "thread-reply-summary",
      "report-summary",
      "onb-step-1-summary",
      "onb-step-2-summary",
      "onb-step-3-summary",
      "onb-step-4-summary",
      "onb-step-5-summary",
      "new-summary",
      "edit-l-001-summary",
      "profile-summary",
    ]);
  });
});
