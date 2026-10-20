import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountView, detailsForm } from "@/components/account/AccountView";
import { PrivacySettingsView } from "@/components/account/PrivacySettingsView";
import { CodeStep, EmailStep, ProfileStep } from "@/components/auth/SignInSteps";
import { OfferView } from "@/components/looking-for/OfferView";
import { RequestFormView, startValues } from "@/components/looking-for/RequestFormView";
import { composerForm, ComposerView } from "@/components/messages/ComposerView";
import { reportForm, ReportView } from "@/components/messages/ReportView";
import { replyForm, ThreadView } from "@/components/messages/ThreadView";
import { ListingFormView } from "@/components/sell/ListingFormView";
import { OnboardingView } from "@/components/sell/OnboardingView";
import { ShopProfileView } from "@/components/sell/ShopProfileView";
import { BookSlotView } from "@/components/hub/BookSlot";
import { AdminFeatured } from "@/components/staff/AdminFeatured";
import { AdminPickupPoints } from "@/components/staff/AdminPickupPoints";
import { AdminReport } from "@/components/staff/AdminReport";
import { AdminStaff } from "@/components/staff/AdminStaff";
import { MentorShop } from "@/components/staff/MentorShop";
import { NEW_POST_VALUES, PostEditor, postValues } from "@/components/staff/PostEditor";
import { ReportConfirm } from "@/components/staff/ReportConfirm";
import { SellerConfirm } from "@/components/staff/SellerConfirm";
import { StaffRoleConfirm } from "@/components/staff/StaffRoleConfirm";
import { campuses } from "@/data/fixtures/campuses";
import { categories } from "@/data/fixtures/categories";
import { pickupPoints } from "@/data/fixtures/pickup-points";
import { requests } from "@/data/fixtures/requests";
import { sampleSellerRows } from "@/data/fixtures/shops";
import { getPostRow } from "@/lib/data/hub-posts";
import { getMentoredShop, listNotes } from "@/lib/data/mentors";
import { createReport } from "@/lib/data/reports";
import { getReport } from "@/lib/data/staff-reports";
import { getShopForReview } from "@/lib/data/staff-shops";
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
vi.mock("@/lib/staff/admin-actions", () => ({
  declineSeller: async () => {},
  dismissReport: async () => {},
  hideReportedListing: async () => {},
  pauseReportedShop: async () => {},
  pauseSeller: async () => {},
  pinSeller: async () => {},
  unpinSeller: async () => {},
  addPoint: async () => {},
  renamePoint: async () => {},
  retirePoint: async () => {},
  restorePoint: async () => {},
}));
vi.mock("@/lib/staff/account-actions", () => ({ giveStaffRole: async () => {}, removeStaffRole: async () => {} }));
vi.mock("@/lib/staff/hub-actions", () => ({ answerSlot: async () => {}, savePost: async () => {} }));
vi.mock("@/lib/hub-actions", () => ({ cancelRsvp: async () => {}, rsvpToEvent: async () => {}, sendSlotRequest: async () => {} }));
vi.mock("@/lib/staff/mentor-actions", () => ({ addCheckIn: async () => {}, addMentorNote: async () => {} }));
vi.mock("@/lib/looking-for/actions", () => ({
  closeMyRequest: async () => {},
  deleteMyRequest: async () => {},
  reopenMyRequest: async () => {},
  saveMyRequest: async () => {},
  sendOffer: async () => {},
}));

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
    once={listingId ? null : "11111111-1111-4111-8111-111111111111"}
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
    const crochet = (await getShopForReview("crochet-corner"))!;
    const tech = (await getShopForReview("tech-corner"))!;
    const reportId = await createReport({
      reporterId: "acc-student",
      target: { kind: "listing", id: "l-001" },
      targetTitle: "Casio fx-991ZA Plus calculator",
      reason: "scam",
      detail: "",
      now: new Date("2026-10-14T08:42:00.000Z"),
    });
    const report = (await getReport(reportId))!;
    const campusChoices = [
      { slug: "midrand", name: "Midrand" },
      { slug: "pretoria", name: "Pretoria" },
    ];
    const editedPost = (await getPostRow("h-002"))!;
    const mentored = (await getMentoredShop(
      "tech-corner",
      { id: "acc-mentor", roles: ["mentor"] },
      new Date("2026-10-14T08:42:00.000Z"),
    ))!;
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
        <SellerConfirm kind="decline" review={crochet} reason="" errors={oops} />
        <SellerConfirm kind="pause" review={tech} reason="" errors={oops} />
        <AdminReport report={report} note="" errors={oops} />
        <ReportConfirm kind="hide" report={report} reason="" errors={oops} />
        <ReportConfirm kind="pause" report={report} reason="" errors={oops} />
        <AdminFeatured
          today="2026-10-14"
          rows={[]}
          pins={[]}
          choices={[]}
          places={[{ slug: "midrand", name: "Midrand" }]}
          values={{}}
          errors={oops}
        />
        <AdminPickupPoints
          campuses={[
            { slug: "midrand", name: "Midrand" },
            { slug: "pretoria", name: "Pretoria" },
          ]}
          points={pickupPoints.map((point) => ({ ...point, retiredAt: null, createdAt: "2026-10-14T08:00:00.000Z" }))}
          addForms={{ midrand: { name: "", errors: oops } }}
          renameForms={{ "pp-pretoria-library": { name: "", errors: oops } }}
        />
        <PostEditor
          postId={null}
          values={NEW_POST_VALUES}
          errors={oops}
          preview="## Bring"
          campuses={campusChoices}
          coverSrc={null}
          once="6f1c2a3e-8c1b-4d6e-9a43-0f6f1b3a9e55"
        />
        <PostEditor
          postId="h-002"
          values={postValues(editedPost)}
          errors={oops}
          preview={null}
          campuses={campusChoices}
          coverSrc={editedPost.image.src}
        />
        <BookSlotView post={editedPost} passed={false} latest={null} values={{}} errors={oops} notice={null} />
        <MentorShop
          shop={mentored}
          campusName="Midrand"
          notes={await listNotes(mentored.ownerId)}
          noteForm={{ values: {}, errors: oops }}
          checkInForm={{ values: {}, errors: oops }}
          noteOnce="0b9d6a1c-2f4e-4c7a-8d15-3e2a7c9b1f60"
          checkInOnce="9a3c1d5e-7b2f-4e8a-b6d4-1c0e5f7a2d83"
          today="2026-10-14"
        />
        <RequestFormView
          requestId={null}
          once="3d8e5c2a-1f47-4b9d-a6c0-7e2b9f1d4a58"
          form={{ values: startValues(null, "midrand"), errors: oops }}
          campuses={campuses}
          categories={categories}
          today="2026-10-14"
        />
        <RequestFormView
          requestId="r-001"
          once={null}
          form={{ values: startValues(null, "midrand"), errors: oops }}
          campuses={campuses}
          categories={categories}
          today="2026-10-14"
        />
        <OfferView
          subject={{ request: requests[0], campusName: "Midrand" }}
          status={{ kind: "open", askerId: "acc-student", shopSlug: "tech-corner", listings: [] }}
          form={{ body: "", listing: "", errors: oops, warnings: [] }}
        />
        <AdminStaff
          people={[]}
          viewerId="acc-admin"
          campusNames={new Map()}
          values={{}}
          errors={oops}
          once="5c2e8a1d-3b4f-4e6a-9d71-2f8c0b6e4a19"
        />
        <StaffRoleConfirm
          person={{
            id: "acc-mentor",
            firstName: "Naledi",
            email: "mentor@eduvos.com",
            campusSlug: "midrand",
            roles: ["mentor"],
            mentors: [],
          }}
          role="mentor"
          viewerId="acc-admin"
          errors={oops}
        />
      </>,
    );
    const summaries = screen.getAllByRole("alert", { name: "There's a problem" });
    expect(summaries).toHaveLength(34);
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
      "decline-crochet-corner-summary",
      "pause-tech-corner-summary",
      `dismiss-${reportId}-summary`,
      `hide-${reportId}-summary`,
      `report-pause-${reportId}-summary`,
      "pin-summary",
      "points-midrand-summary",
      "points-pretoria-summary",
      // Not "…-summary": that is the editor's Summary field's id.
      "new-post-problems",
      "edit-h-002-problems",
      "book-h-002-summary",
      "note-tech-corner-summary",
      "check-in-tech-corner-summary",
      "request-new-summary",
      "request-r-001-summary",
      "offer-r-001-summary",
      "give-role-problems",
      "remove-mentor-acc-mentor-summary",
    ]);
  });
});
