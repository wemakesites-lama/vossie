"use server";

import { notFound } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { recordAudit } from "@/lib/data/audit";
import { addNote, getMentoredShop } from "@/lib/data/mentors";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field } from "@/lib/selling/action-helpers";
import { sastDate } from "@/lib/time";
import type { Account, MentoredShop } from "@/lib/types";
import { requireStaff } from "./access";
import { checkInForm, clearStaffForm, leaveNotice, noteForm } from "./form-state";
import { MENTOR_PATH, mentorShopPath } from "./paths";
import { checkCheckInDay, checkMentorNote } from "./rules";

// Mentors' notes and check-ins (staff tools spec 2.6, plan decision 16): about a shop's owner, by its mentor or an
// admin, never shown to the seller. The audit entry says a note was added, never what it says.

/** The signed-in staff member and the shop, when they may write about it; the 404 otherwise. */
async function mentoredFrom(formData: FormData, now: Date): Promise<{ account: Account; shop: MentoredShop }> {
  const slug = field(formData, "shop");
  const account = await requireStaff("mentor", isId(slug) ? mentorShopPath(slug) : MENTOR_PATH);
  const shop = isId(slug) ? await getMentoredShop(slug, account, now) : null;
  if (!shop) notFound();
  return { account, shop };
}

/** Add a note (spec 2.6). */
export async function addMentorNote(formData: FormData): Promise<void> {
  const now = new Date();
  const { account, shop } = await mentoredFrom(formData, now);
  const path = mentorShopPath(shop.slug);
  const text = checkMentorNote(field(formData, "text"));
  if (text.error) {
    const values = { text: keepTyped(text.value) };
    await writeFormState(noteForm(shop.slug), { errors: [text.error], values, notice: null }, now);
    done(`${path}#mentor-${shop.slug}-add-note`);
  }
  await addNote({
    ownerId: shop.ownerId,
    kind: "note",
    checkInOn: null,
    text: text.value,
    author: { id: account.id, firstName: account.firstName },
    now,
  });
  await recordAudit({
    staff: { id: account.id, firstName: account.firstName },
    action: "note-added",
    target: { kind: "shop", id: shop.slug, name: shop.name },
    subjectId: shop.ownerId,
    now,
  });
  await clearStaffForm(noteForm(shop.slug));
  await leaveNotice("note-added", now);
  done(`${path}#mentor-${shop.slug}-notes`);
}

/** Add a check-in (spec 2.6): its date, today or earlier in SAST, and what was said. */
export async function addCheckIn(formData: FormData): Promise<void> {
  const now = new Date();
  const { account, shop } = await mentoredFrom(formData, now);
  const path = mentorShopPath(shop.slug);
  const day = checkCheckInDay(field(formData, "day"), sastDate(now));
  const text = checkMentorNote(field(formData, "text"));
  const errors = [day.error, text.error].filter((error): error is NonNullable<typeof error> => error !== null);
  if (errors.length > 0) {
    const values = { day: keepTyped(field(formData, "day")), text: keepTyped(text.value) };
    await writeFormState(checkInForm(shop.slug), { errors, values, notice: null }, now);
    done(`${path}#mentor-${shop.slug}-add-check-in`);
  }
  await addNote({
    ownerId: shop.ownerId,
    kind: "check-in",
    checkInOn: day.value,
    text: text.value,
    author: { id: account.id, firstName: account.firstName },
    now,
  });
  await recordAudit({
    staff: { id: account.id, firstName: account.firstName },
    action: "check-in-added",
    target: { kind: "shop", id: shop.slug, name: shop.name },
    detail: day.value,
    subjectId: shop.ownerId,
    now,
  });
  await clearStaffForm(checkInForm(shop.slug));
  await leaveNotice("check-in-added", now);
  done(`${path}#mentor-${shop.slug}-notes`);
}
