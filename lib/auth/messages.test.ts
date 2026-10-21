import { describe, expect, it } from "vitest";
import { errorFor, formErrors, SIGN_IN_FIELDS } from "./messages";

describe("error messages (accounts spec 3.1, plan decision 7)", () => {
  it("words each sign-in error as the spec does, linked to its field", () => {
    expect(formErrors(["email-missing", "consent-missing"], SIGN_IN_FIELDS)).toEqual([
      { message: "Enter your email address.", fieldId: "signin-email" },
      { message: "Tick the box to agree to the privacy policy.", fieldId: "signin-consent" },
    ]);
    expect(formErrors(["email-domain"], SIGN_IN_FIELDS)).toEqual([
      { message: "Use your Eduvos email address.", fieldId: "signin-email" },
    ]);
    expect(formErrors(["code-missing", "code-expired"], SIGN_IN_FIELDS)).toEqual([
      { message: "Enter the 6-digit code.", fieldId: "signin-code" },
      { message: "That code has expired. Send a new one.", fieldId: "signin-code" },
    ]);
    expect(formErrors(["locked"], SIGN_IN_FIELDS)).toEqual([
      { message: "Too many tries. Start again.", fieldId: "signin-email" },
    ]);
  });

  it("counts the tries left on a wrong code", () => {
    expect(formErrors(["code-wrong"], SIGN_IN_FIELDS, 1)[0].message).toBe("That code isn't right. 4 tries left.");
    expect(formErrors(["code-wrong"], SIGN_IN_FIELDS, 4)[0].message).toBe("That code isn't right. 1 try left.");
  });

  it("says when the hour's codes are used up, on whichever step asked", () => {
    const rate = "You've asked for 5 codes in the last hour. Try again later.";
    expect(formErrors(["email-rate"], SIGN_IN_FIELDS)).toEqual([{ message: rate, fieldId: "signin-email" }]);
    expect(formErrors(["code-rate"], SIGN_IN_FIELDS)).toEqual([{ message: rate, fieldId: "signin-code" }]);
  });

  it("words step 3's and the account forms' errors", () => {
    const fields = { firstName: "details-first-name", campus: "details-campus", confirm: "delete-confirm" };
    expect(formErrors(["first-name-missing", "first-name-length", "campus-missing", "confirm-missing"], fields)).toEqual([
      { message: "Enter your first name.", fieldId: "details-first-name" },
      { message: "Your first name must be 2 to 40 characters.", fieldId: "details-first-name" },
      { message: "Choose your campus.", fieldId: "details-campus" },
      { message: "Tick the box to confirm you understand.", fieldId: "delete-confirm" },
    ]);
  });

  it("leaves an error unlinked when the form has no such field, and drops codes it doesn't know", () => {
    expect(formErrors(["consent-missing"], { email: "x" })).toEqual([
      { message: "Tick the box to agree to the privacy policy.", fieldId: null },
    ]);
    expect(formErrors(["nonsense", "toString"], SIGN_IN_FIELDS)).toEqual([]);
  });

  it("finds the message for one field, for the line under it", () => {
    const errors = formErrors(["email-domain", "consent-missing"], SIGN_IN_FIELDS);
    expect(errorFor(errors, "signin-consent")).toBe("Tick the box to agree to the privacy policy.");
    expect(errorFor(errors, "signin-code")).toBeUndefined();
  });

  it("words Supabase's refusals (Supabase phase B decision 6, amendment 18), on step 1's email field", () => {
    expect(formErrors(["code-soon", "ip-rate", "send-failed", "code-check-failed"], SIGN_IN_FIELDS)).toEqual([
      { message: "We sent you a code less than a minute ago. Wait a minute, then ask again.", fieldId: "signin-email" },
      { message: "Too many sign-ins from your network just now. Try again in a few minutes.", fieldId: "signin-email" },
      { message: "We couldn't send the code just now. Try again in a few minutes.", fieldId: "signin-email" },
      { message: "We couldn't check the code just now. Try again in a minute.", fieldId: "signin-email" },
    ]);
  });

  it("lists them unlinked on step 2, which has no email field", () => {
    expect(formErrors(["code-soon", "code-check-failed"], { code: SIGN_IN_FIELDS.code })).toEqual([
      { message: "We sent you a code less than a minute ago. Wait a minute, then ask again.", fieldId: null },
      { message: "We couldn't check the code just now. Try again in a minute.", fieldId: null },
    ]);
  });
});
