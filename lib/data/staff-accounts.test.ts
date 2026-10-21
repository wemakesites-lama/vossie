import { beforeEach, describe, expect, it } from "vitest";
import { createAccount } from "./accounts";
import { countAdmins, getStaffAccount, giveRole, listStaffAccounts, ownShopMentorId, removeRole } from "./staff-accounts";
import { resetSampleStore, sampleStore } from "./store";

const NOW = new Date("2026-10-20T08:00:00.000Z");

beforeEach(() => {
  resetSampleStore();
});

/** A student who has signed in once (stage J spec decision 3: no account, no role). */
async function zola() {
  return createAccount({ email: "zola@eduvos.com", firstName: "Zola", campusSlug: "pretoria", now: NOW });
}

describe("who has a role (stage J spec decision 2)", () => {
  it("lists everyone with a role and no one else, by first name then email, with the shops each mentors", async () => {
    const people = await listStaffAccounts();
    expect(people).toEqual([
      {
        id: "acc-mentor",
        firstName: "Naledi",
        email: "mentor@eduvos.com",
        campusSlug: "midrand",
        roles: ["mentor"],
        mentors: ["Tech corner"],
      },
      {
        id: "acc-admin",
        firstName: "Pieter",
        email: "admin@eduvos.com",
        campusSlug: "pretoria",
        roles: ["admin"],
        mentors: [],
      },
    ]);
    // Students without a role never appear, in any form.
    expect(JSON.stringify(people)).not.toMatch(/student@|seller@|pending@/);
  });

  it("sorts two people with the same first name by email, and writes roles mentor first", async () => {
    const other = await createAccount({ email: "a-naledi@eduvos.com", firstName: "Naledi", campusSlug: "midrand", now: NOW });
    sampleStore().accounts.get(other.id)!.roles = ["admin", "mentor"];
    const people = await listStaffAccounts();
    expect(people.map((person) => person.email)).toEqual(["a-naledi@eduvos.com", "mentor@eduvos.com", "admin@eduvos.com"]);
    expect(people[0].roles).toEqual(["mentor", "admin"]);
  });

  it("reads one person with a role, and nobody without one", async () => {
    expect(await getStaffAccount("acc-mentor")).toMatchObject({ firstName: "Naledi", mentors: ["Tech corner"] });
    expect(await getStaffAccount("acc-student")).toBeNull();
    expect(await getStaffAccount("acc-nobody")).toBeNull();
  });

  it("counts the admins", async () => {
    expect(await countAdmins()).toBe(1);
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    expect(await countAdmins()).toBe(2);
  });
});

describe("giving a role by exact email (stage J spec decisions 3 and 6)", () => {
  it("gives the role to the account with that email, whatever its case and spaces, and changes nothing else", async () => {
    const account = await zola();
    const before = structuredClone(sampleStore());
    expect(await giveRole("  ZOLA@Eduvos.com ", "mentor")).toEqual({ id: account.id, firstName: "Zola" });
    expect(sampleStore().accounts.get(account.id)?.roles).toEqual(["mentor"]);
    // Only the roles changed: no session, shop, notification or other account.
    sampleStore().accounts.get(account.id)!.roles = [];
    expect(sampleStore()).toEqual(before);
  });

  it("adds a second role in the fixed order", async () => {
    expect(await giveRole("admin@eduvos.com", "mentor")).toEqual({ id: "acc-admin", firstName: "Pieter" });
    expect(sampleStore().accounts.get("acc-admin")?.roles).toEqual(["mentor", "admin"]);
  });

  it("refuses an email no account uses, and never makes one", async () => {
    const accounts = sampleStore().accounts.size;
    expect(await giveRole("nobody@eduvos.com", "admin")).toBe("no-account");
    expect(await giveRole("", "admin")).toBe("no-account");
    expect(sampleStore().accounts.size).toBe(accounts);
  });

  it("says when the account has that role already", async () => {
    expect(await giveRole("mentor@eduvos.com", "mentor")).toBe("held");
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
  });
});

describe("taking a role away (stage J spec decisions 5 and 6)", () => {
  it("removes a mentor role, clears that mentor from every shop, and keeps their notes, check-ins and posts", async () => {
    const notes = [...sampleStore().mentorNotes.values()].filter((row) => row.authorId === "acc-mentor").length;
    const posts = [...sampleStore().hubPosts.values()].filter((row) => row.authorId === "acc-mentor").length;
    expect(notes).toBeGreaterThan(0);
    expect(await removeRole("acc-mentor", "mentor", "acc-admin")).toEqual({
      id: "acc-mentor",
      firstName: "Naledi",
      role: "mentor",
      unassigned: ["Tech corner"],
    });
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual([]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
    expect([...sampleStore().mentorNotes.values()].filter((row) => row.authorId === "acc-mentor")).toHaveLength(notes);
    expect([...sampleStore().hubPosts.values()].filter((row) => row.authorId === "acc-mentor")).toHaveLength(posts);
  });

  it("lets a mentor remove their own mentor role", async () => {
    expect(await removeRole("acc-mentor", "mentor", "acc-mentor")).toMatchObject({ role: "mentor" });
  });

  it("never removes your own admin role", async () => {
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    expect(await removeRole("acc-admin", "admin", "acc-admin")).toBe("own-admin");
    expect(sampleStore().accounts.get("acc-admin")?.roles).toEqual(["admin"]);
  });

  it("never removes the last admin, even when another id asks", async () => {
    expect(await removeRole("acc-admin", "admin", "acc-mentor")).toBe("last-admin");
    expect(sampleStore().accounts.get("acc-admin")?.roles).toEqual(["admin"]);
  });

  it("removes another admin's role while one is left", async () => {
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    expect(await removeRole("acc-mentor", "admin", "acc-admin")).toEqual({
      id: "acc-mentor",
      firstName: "Naledi",
      role: "admin",
      unassigned: [],
    });
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
    // Removing an admin role leaves the shops they mentor alone.
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
  });

  it("leaves one admin when two admins remove each other at once, the second getting last-admin", async () => {
    sampleStore().accounts.get("acc-mentor")!.roles.push("admin");
    const results = await Promise.all([
      removeRole("acc-admin", "admin", "acc-mentor"),
      removeRole("acc-mentor", "admin", "acc-admin"),
    ]);
    expect(results.filter((result) => result === "last-admin")).toHaveLength(1);
    expect(results.filter((result) => typeof result === "object" && result !== null)).toHaveLength(1);
    expect(await countAdmins()).toBe(1);
  });

  it("changes nothing for a role already gone or an unknown account", async () => {
    expect(await removeRole("acc-student", "mentor", "acc-admin")).toBeNull();
    expect(await removeRole("acc-nobody", "admin", "acc-admin")).toBeNull();
  });
});

describe("the mentor of the admin's own shop (stage M spec decisions 1 to 5)", () => {
  it("reads who mentors an owner's shop from the store: Naledi for Sipho, nobody for Lerato or a student", () => {
    expect(ownShopMentorId("acc-seller")).toBe("acc-mentor");
    expect(ownShopMentorId("acc-pending")).toBeNull();
    expect(ownShopMentorId("acc-student")).toBeNull();
    sampleStore().sellerProfiles.get("acc-seller")!.mentorId = null;
    expect(ownShopMentorId("acc-seller")).toBeNull();
  });

  it("refuses to remove the mentor role of whoever mentors the asking admin's own shop, changing nothing at all", async () => {
    sampleStore().accounts.get("acc-seller")!.roles = ["admin"];
    const before = structuredClone(sampleStore());
    expect(await removeRole("acc-mentor", "mentor", "acc-seller")).toBe("own-shop-mentor");
    expect(sampleStore()).toEqual(before);
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
  });

  it("goes by the seller profile, not the live shop: a paused shop is still the admin's own", async () => {
    sampleStore().sellerProfiles.get("acc-seller")!.status = "paused";
    expect(await removeRole("acc-mentor", "mentor", "acc-seller")).toBe("own-shop-mentor");
  });

  it("still lets another admin remove it, and Tech corner loses its mentor as before (stage J)", async () => {
    expect(await removeRole("acc-mentor", "mentor", "acc-admin")).toMatchObject({
      role: "mentor",
      unassigned: ["Tech corner"],
    });
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBeNull();
  });

  it("leaves removing the admin role alone, for someone who holds both (decision 3)", async () => {
    sampleStore().accounts.get("acc-mentor")!.roles = ["mentor", "admin"];
    expect(await removeRole("acc-mentor", "admin", "acc-seller")).toMatchObject({ role: "admin", unassigned: [] });
    expect(sampleStore().accounts.get("acc-mentor")?.roles).toEqual(["mentor"]);
    expect(sampleStore().sellerProfiles.get("acc-seller")?.mentorId).toBe("acc-mentor");
  });
});
