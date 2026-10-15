import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountView, detailsForm } from "@/components/account/AccountView";
import { PrivacySettingsView } from "@/components/account/PrivacySettingsView";
import { CodeStep, EmailStep, ProfileStep } from "@/components/auth/SignInSteps";
import { composerForm, ComposerView } from "@/components/messages/ComposerView";
import { reportForm, ReportView } from "@/components/messages/ReportView";
import { replyForm, ThreadView } from "@/components/messages/ThreadView";
import { ListingFormView } from "@/components/sell/ListingFormView";
import { OnboardingView } from "@/components/sell/OnboardingView";
import { ShopProfileView } from "@/components/sell/ShopProfileView";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import { sampleSellerRows } from "@/data/fixtures/shops";
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

const wizardDraft = {
  accountId: "acc-student",
  name: "Zola's Bakes",
  tagline: "",
  categorySlug: "food",
  about: "I bake between lectures.",
  photoSrc: null,
  campusSlug: "midrand",
  pickupPointIds: ["pp-midrand-library"],
  updatedAt: "2026-10-14T08:00:00.000Z",
};

/** One of the onboarding wizard's steps with a summary showing (selling plan amendment 1). */
const wizardStep = (step: 1 | 2 | 3 | 4 | 5) => (
  <OnboardingView
    step={step}
    draft={wizardDraft}
    errors={oops}
    campuses={campuses}
    categories={categories}
    pickupPoints={pickupPoints}
  />
);

/** Edit shop, with a summary showing and the link field there (an approved shop that hasn't changed its link). */
const shopProfile = () => (
  <ShopProfileView
    shop={structuredClone(sampleSellerRows.find((shop) => shop.slug === "tech-corner")!)}
    status="approved"
    typed={null}
    errors={oops}
    notice={null}
    campuses={campuses}
    categories={categories}
    pickupPoints={pickupPoints}
    host="vossie.test"
  />
);

/** The listing form, new or editing one listing, with a summary showing (selling plan amendment 1). */
const listingForm = (listingId: string | null) => (
  <ListingFormView
    listingId={listingId}
    state={listingId ? "available" : null}
    waiting={false}
    values={{ kind: "item", payMode: "cash", handover: "pickup", pickup: "pp-midrand-library" }}
    photos={[{ src: "/placeholders/listing/tech.svg", alt: "", thumb: "/placeholders/listing/tech.svg" }]}
    errors={oops}
    categories={categories}
    spots={pickupPoints.filter((point) => point.campusSlug === "midrand")}
    campusName="Midrand"
  />
);

describe("error summary ids (accounts spec 6)", () => {
  // Next keeps the last pages hidden in the DOM, so the sign-in steps, the account page and the privacy settings page
  // can all be there together. Every id, and so every summary's, must be unique across them.
  it("never repeats an id when every form shows a summary at once", async () => {
    const composer = (await composerSubject({ kind: "listing", listingId: "l-007" }))!;
    const composerWithErrors = composerForm(
      {
        key: "s:composer:listing:l-007",
        sessionKey: "s",
        form: "composer:listing:l-007",
        errors: ["message-missing"],
        values: {},
        notice: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      { kind: "listing", listingId: "l-007" },
    );
    const threadWithErrors = replyForm(
      {
        key: "s:reply:conv-test",
        sessionKey: "s",
        form: "reply:conv-test",
        errors: ["message-missing"],
        values: {},
        notice: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      "conv-test",
    );
    const reportWithErrors = reportForm(
      {
        key: "s:report:listing:l-001",
        sessionKey: "s",
        form: "report:listing:l-001",
        errors: ["reason-missing"],
        values: {},
        notice: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      { kind: "listing", id: "l-001" },
    );
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
        <ComposerView subject={composer} status={{ kind: "open" }} form={composerWithErrors} />
        <ThreadView
          thread={makeThread()}
          now={new Date("2026-10-14T13:00:00Z")}
          reply={threadWithErrors}
          sent={false}
          campusName="Midrand"
        />
        <ReportView
          target={{ kind: "listing", id: "l-001" }}
          subject={{ title: "Casio fx-991ZA Plus calculator", href: "/listings/l-001", backLabel: "Back to the listing" }}
          already={false}
          form={reportWithErrors}
        />
        {wizardStep(1)}
        {wizardStep(2)}
        {wizardStep(3)}
        {wizardStep(4)}
        {wizardStep(5)}
        {shopProfile()}
        {listingForm(null)}
        {listingForm("l-001")}
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
      "profile-summary",
      "new-summary",
      "edit-l-001-summary",
    ]);
  });
});
