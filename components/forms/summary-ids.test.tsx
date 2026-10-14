import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountView, detailsForm } from "@/components/account/AccountView";
import { PrivacySettingsView } from "@/components/account/PrivacySettingsView";
import { CodeStep, EmailStep, ProfileStep } from "@/components/auth/SignInSteps";
import { composerForm, ComposerView } from "@/components/messages/ComposerView";
import { replyForm, ThreadView } from "@/components/messages/ThreadView";
import { campuses } from "@/data/fixtures/campuses";
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

describe("error summary ids (accounts spec 6)", () => {
  // Next keeps the last pages hidden in the DOM, so the sign-in steps, the account page and the privacy settings page
  // can all be there together. Every id, and so every summary's, must be unique across them.
  it("never repeats an id when every form shows a summary at once", async () => {
    const composer = (await composerSubject({ kind: "listing", listingId: "l-007" }))!;
    const composerWithErrors = composerForm({
      key: "s:composer:listing:l-007",
      sessionKey: "s",
      form: "composer:listing:l-007",
      errors: ["message-missing"],
      values: {},
      notice: null,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const threadWithErrors = replyForm({
      key: "s:reply:conv-test",
      sessionKey: "s",
      form: "reply:conv-test",
      errors: ["message-missing"],
      values: {},
      notice: null,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    render(
      <>
        <EmailStep next={null} email="" consented={false} errors={oops} samples={null} />
        <CodeStep next={null} maskedEmail="t•••@eduvos.com" errors={oops} resent={false} sampleCode={null} />
        <ProfileStep next={null} firstName="" campus="" campuses={campuses} errors={oops} />
        <AccountView
          account={account}
          campuses={campuses}
          details={{ ...detailsForm(account, null), errors: oops }}
        />
        <PrivacySettingsView consent={null} deleteErrors={oops} />
        <ComposerView subject={composer} status={{ kind: "open" }} form={composerWithErrors} />
        <ThreadView
          thread={makeThread()}
          now={new Date("2026-10-14T13:00:00Z")}
          reply={threadWithErrors}
          sent={false}
          campusName="Midrand"
        />
      </>,
    );
    const summaries = screen.getAllByRole("alert", { name: "There's a problem" });
    expect(summaries).toHaveLength(7);
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
    ]);
  });
});
