import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState, writeFormState } from "@/lib/auth/form-state";
import { createAccount, deleteAccountData } from "@/lib/data/accounts";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { giveStaffRole, removeStaffRole } from "./account-actions";
import { GIVE_ROLE_FORM, removeRoleForm, STAFF_NOTICE } from "./form-state";
import { issueOnceToken } from "./once";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

const asAdmin = () => signedInAs(request, "acc-admin");
const notice = async () => (await readFormState(STAFF_NOTICE))?.notice ?? null;
const auditRows = () => [...sampleStore().auditLog.values()];
const notesOf = (accountId: string) =>
  [...sampleStore().notifications.values()].filter((row) => row.accountId === accountId && row.kind === "staff-role");

/** A student who has signed in once (spec decision 3). */
async function zola() {
  return createAccount({ email: "zola@eduvos.com", firstName: "Zola", campusSlug: "pretoria", now: STAFF_NOW });
}

/** Give a staff role's form, as the page draws it: with a fresh token for this session. */
async function giveForm(fields: Record<string, string>): Promise<FormData> {
  return form({ once: (await issueOnceToken()) ?? "", ...fields });
}

describe("the gate (stage J spec section 5)", () => {
  it("has a case for every exported action, so a new action can't skip the gate's test", async () => {
    // The gate test below covers these two; a new export fails here until it's added to both lists.
    const exported = Object.keys(await import("./account-actions")).sort();
    expect(exported).toEqual(["giveStaffRole", "removeStaffRole"]);
  });

  it("sends a signed-out visitor to sign in, and gives a mentor or a student the 404, changing nothing", async () => {
    expect(await redirectOf(() => giveStaffRole(form({ email: "zola@eduvos.com", role: "mentor" })))).toBe(
      "/login?next=%2Fadmin%2Fstaff",
    );
    expect(await redirectOf(() => removeStaffRole(form({ account: "acc-mentor", role: "mentor" })))).toBe(
      "/login?next=%2Fadmin%2Fstaff%2Facc-mentor%2Fremove-mentor",
    );
    await zola();
    for (const accountId of ["acc-mentor", "acc-student"]) {
      await signedInAs(request, accountId);
      const before = structuredClone(sampleStore());
      await expect(giveStaffRole(await giveForm({ email: "zola@eduvos.com", role: "admin" }))).rejects.toThrow("notFound");
      await expect(removeStaffRole(form({ account: "acc-mentor", role: "mentor" }))).rejects.toThrow("notFound");
      // The token the form drew is the only change, and it's this session's form state.
      sampleStore().formStates.clear();
      before.formStates.clear();
      expect(sampleStore(), accountId).toEqual(before);
    }
  });
});

describe("giving a role (stage J spec decisions 3, 6 and 7)", () => {
  it("gives the role by exact email: one entry, the person told, a notice, and no tag", async () => {
    const account = await zola();
    await asAdmin();
    const sent = await giveForm({ email: "  ZOLA@Eduvos.com ", role: "mentor" });
    expect(await redirectOf(() => giveStaffRole(sent))).toBe("/admin/staff");
    expect(sampleStore().accounts.get(account.id)?.roles).toEqual(["mentor"]);
    expect(auditRows()).toEqual([
      expect.objectContaining({
        action: "role-given",
        staffId: "acc-admin",
        staffName: "Pieter",
        targetKind: "account",
        targetId: account.id,
        targetName: "Zola",
        detail: "Mentor",
        subjectId: account.id,
      }),
    ]);
    expect(notesOf(account.id)).toEqual([
      expect.objectContaining({
        subjectId: "mentor",
        text: "You're a CampusCart mentor now. The Hub's tools and the mentor dashboard are on your account page.",
        href: "/account",
        readAt: null,
      }),
    ]);
    expect(await notice()).toBe("role-given");
    expect(request.updatedTags).toEqual([]);
    expect(request.refreshed).toBe(true);
  });

  it("gives nothing on a second press of the same form, and goes where the first went", async () => {
    const account = await zola();
    await asAdmin();
    const sent = await giveForm({ email: "zola@eduvos.com", role: "admin" });
    await redirectOf(() => giveStaffRole(sent));
    expect(await redirectOf(() => giveStaffRole(sent))).toBe("/admin/staff");
    expect(await notice()).toBe("role-given");
    expect(auditRows()).toHaveLength(1);
    expect(notesOf(account.id)).toHaveLength(1);
    expect(sampleStore().accounts.get(account.id)?.roles).toEqual(["admin"]);
  });

  it("keeps the errors and the typed email in form state, never the link, and gives nothing", async () => {
    await zola();
    await asAdmin();
    const cases: Array<[Record<string, string>, string[], string]> = [
      [{ email: "", role: "" }, ["staff-email-missing", "staff-role-missing"], ""],
      [{ email: "nobody@eduvos.com", role: "mentor" }, ["staff-email-unknown"], "nobody@eduvos.com"],
      [{ email: "zola@eduvos.com", role: "owner" }, ["staff-role-missing"], "zola@eduvos.com"],
      [{ email: "Mentor@Eduvos.com", role: "mentor" }, ["staff-role-held"], "Mentor@Eduvos.com"],
    ];
    for (const [fields, errors, typed] of cases) {
      expect(await redirectOf(async () => giveStaffRole(await giveForm(fields)))).toBe("/admin/staff");
      expect(await readFormState(GIVE_ROLE_FORM), JSON.stringify(fields)).toMatchObject({ errors, values: { email: typed } });
    }
    expect(auditRows()).toEqual([]);
    expect(notesOf("acc-mentor")).toEqual([]);
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
  });

  it("refuses a role the person holds before taking the token, so the same form can be sent again with another email", async () => {
    const account = await zola();
    await asAdmin();
    const sent = await giveForm({ email: "mentor@eduvos.com", role: "mentor" });
    expect(await redirectOf(() => giveStaffRole(sent))).toBe("/admin/staff");
    expect((await readFormState(GIVE_ROLE_FORM))?.errors).toEqual(["staff-role-held"]);
    // The token is still good: the same form, corrected, gives the role instead of being sent on silently.
    sent.set("email", "zola@eduvos.com");
    expect(await redirectOf(() => giveStaffRole(sent))).toBe("/admin/staff");
    expect(await notice()).toBe("role-given");
    expect(sampleStore().accounts.get(account.id)?.roles).toEqual(["mentor"]);
    expect(auditRows()).toHaveLength(1);
  });

  it("keeps a chosen role with the error, so the radio stays chosen", async () => {
    await asAdmin();
    await redirectOf(async () => giveStaffRole(await giveForm({ email: "nobody@eduvos.com", role: "admin" })));
    expect((await readFormState(GIVE_ROLE_FORM))?.values).toEqual({ email: "nobody@eduvos.com", role: "admin" });
  });

  it("refuses a form with no token, or a made-up one, and gives nothing", async () => {
    await zola();
    await asAdmin();
    for (const once of ["", "6f1c2a3e-8c1b-4d6e-9a43-0f6f1b3a9e55"]) {
      expect(await redirectOf(() => giveStaffRole(form({ once, email: "zola@eduvos.com", role: "mentor" })))).toBe(
        "/admin/staff",
      );
      expect((await readFormState(GIVE_ROLE_FORM))?.errors).toEqual(["once-expired"]);
    }
    expect(auditRows()).toEqual([]);
  });

  it("forgets the person in the log when their account is deleted (staff tools spec 8.11)", async () => {
    const account = await zola();
    await asAdmin();
    await redirectOf(async () => giveStaffRole(await giveForm({ email: "zola@eduvos.com", role: "mentor" })));
    await deleteAccountData(account.id);
    expect(auditRows()[0]).toMatchObject({ action: "role-given", targetId: "", targetName: "Deleted account", subjectId: null });
  });
});

describe("taking a role away (stage J spec decisions 4 to 7)", () => {
  it("removes a mentor role: one entry naming the shops left without a mentor, the person told, a notice", async () => {
    await asAdmin();
    expect(await redirectOf(() => removeStaffRole(form({ account: "acc-mentor", role: "mentor" })))).toBe("/admin/staff");
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual([]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect(auditRows()).toEqual([
      expect.objectContaining({
        action: "role-removed",
        targetKind: "account",
        targetId: "acc-mentor",
        targetName: "Naledi",
        detail: "Mentor. No mentor now: Tech corner",
        subjectId: "acc-mentor",
      }),
    ]);
    expect(notesOf("acc-mentor")).toEqual([
      expect.objectContaining({
        subjectId: "mentor",
        text: "Your mentor role on CampusCart has ended. Thank you for helping student sellers.",
        href: "/account",
      }),
    ]);
    // Naledi's notes and check-ins stay.
    expect([...sampleStore().mentorNotes.values()].some((row) => row.authorId === "acc-mentor")).toBe(true);
    expect(await notice()).toBe("role-removed");
    expect(request.updatedTags).toEqual([]);
  });

  it("removes another admin's role, and words the entry Admin", async () => {
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    await asAdmin();
    await redirectOf(() => removeStaffRole(form({ account: "acc-mentor", role: "admin" })));
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
    expect(auditRows()[0]).toMatchObject({ action: "role-removed", detail: "Admin" });
    expect(notesOf("acc-mentor")[0]?.text).toBe("Your admin role on CampusCart has ended.");
  });

  it("refuses your own admin role, back on its confirm page with the words, changing nothing", async () => {
    await asAdmin();
    expect(await redirectOf(() => removeStaffRole(form({ account: "acc-admin", role: "admin" })))).toBe(
      "/admin/staff/acc-admin/remove-admin",
    );
    expect((await readFormState(removeRoleForm("acc-admin", "admin")))?.errors).toEqual(["staff-own-admin"]);
    expect(sampleStore().accounts.get("acc-admin")?.roles).toEqual(["admin"]);
    expect(auditRows()).toEqual([]);
    expect(notesOf("acc-admin")).toEqual([]);
  });

  it("says nothing changed for a role already gone, a forged role or a bad id, writing and sending nothing", async () => {
    await asAdmin();
    for (const fields of [
      { account: "acc-student", role: "mentor" },
      { account: "acc-mentor", role: "owner" },
      { account: "<bad>", role: "mentor" },
    ]) {
      expect(await redirectOf(() => removeStaffRole(form(fields)))).toBe("/admin/staff");
      expect(await notice(), JSON.stringify(fields)).toBe("nothing");
    }
    expect(auditRows()).toEqual([]);
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
  });
});

describe("the mentor of the admin's own shop (stage M spec decisions 2, 5 and 7)", () => {
  /** The store as a refusal must leave it: everything but form state, which may gain only the notice. */
  function everythingButFormState() {
    const copy = structuredClone(sampleStore());
    copy.formStates.clear();
    return copy;
  }

  it("refuses Sipho, an admin, removing Naledi's mentor role: only the notice, on the staff page", async () => {
    sampleStore().accounts.get("acc-seller")!.roles = ["admin"];
    await signedInAs(request, "acc-seller");
    // A refusal left on the confirm page by an earlier try stays as it was: the form state isn't written or cleared.
    await writeFormState(removeRoleForm("acc-mentor", "mentor"), { errors: ["once-expired"], values: {}, notice: null }, STAFF_NOW);
    const before = everythingButFormState();
    const redirect = await redirectSignalOf(() => removeStaffRole(form({ account: "acc-mentor", role: "mentor" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/admin/staff", "replace", true]);
    expect(everythingButFormState()).toEqual(before);
    expect(await notice()).toBe("own-shop-mentor");
    expect((await readFormState(removeRoleForm("acc-mentor", "mentor")))?.errors).toEqual(["once-expired"]);
    expect([auditRows(), notesOf("acc-mentor"), request.updatedTags]).toEqual([[], [], []]);
  });

  it("still lets another admin remove it", async () => {
    sampleStore().accounts.get("acc-seller")!.roles = ["admin"];
    await asAdmin();
    expect(await redirectOf(() => removeStaffRole(form({ account: "acc-mentor", role: "mentor" })))).toBe("/admin/staff");
    expect(await notice()).toBe("role-removed");
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect(auditRows()).toHaveLength(1);
  });

  it("checks the role first: Sipho without the Admin role gets the 404, never the notice (spec section 3, Rules)", async () => {
    await signedInAs(request, "acc-seller");
    await expect(removeStaffRole(form({ account: "acc-mentor", role: "mentor" }))).rejects.toThrow("notFound");
    expect(await notice()).toBeNull();
  });
});
