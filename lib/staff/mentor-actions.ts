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
import { leaveOnceToken, type OnceSent, sentOnceToken, takeOnceToken } from "./once";
import { MENTOR_PATH, mentorShopPath } from "./paths";
import { checkCheckInDay, checkMentorNote } from "./rules";

// Mentors' notes and check-ins (staff tools spec 2.6, plan decision 16): about a shop's owner, by its mentor or an
// admin, never shown to the seller. The audit entry says a note was added, never what it says.
//
// Each is made once, however many times its form is sent (amendment 15.7): the form carries a one-time token
// (lib/staff/once.ts), and only the first save to take it adds anything. A later one goes where the first went; one
// with no token, or a made-up or run-out one, is refused with the form's error and what was typed. A save that fails
// its checks leaves the token for the next try.

/** The signed-in staff member and the shop, when they may write about it; the 404 otherwise. */
async function mentoredFrom(formData: FormData, now: Date): Promise<{ account: Account; shop: MentoredShop }> {
  const slug = field(formData, "shop");
  const account = await requireStaff("mentor", isId(slug) ? mentorShopPath(slug) : MENTOR_PATH);
  const shop = isId(slug) ? await getMentoredShop(slug, account, now) : null;
  if (!shop) notFound();
  return { account, shop };
}

/** A form sent again after its first send was made: back to where that went, with the notice it left. */
async function sentAgain(sent: OnceSent, now: Date): Promise<never> {
  await leaveNotice(sent.notice, now);
  done(sent.path);
}

/**
 * Takes the form's token, now that something is about to be written. A token that is none of this session's sends the
 * form back with its words (`back`); one already taken goes where the first send went.
 */
async function takeOnce(
  once: string,
  now: Date,
  back: { form: string; values: Record<string, string>; path: string },
  fallback: string,
): Promise<void> {
  const token = await takeOnceToken(once, now);
  if (token.kind === "none") {
    await writeFormState(back.form, { errors: ["once-expired"], values: back.values, notice: null }, now);
    done(back.path);
  }
  if (token.kind === "again") {
    if (token.sent) await sentAgain(token.sent, now);
    done(fallback);
  }
}

/** Add a note (spec 2.6). */
export async function addMentorNote(formData: FormData): Promise<void> {
  const now = new Date();
  const { account, shop } = await mentoredFrom(formData, now);
  const path = mentorShopPath(shop.slug);
  const notes = `${path}#mentor-${shop.slug}-notes`;
  const once = field(formData, "once");
  const earlier = await sentOnceToken(once, now);
  if (earlier) await sentAgain(earlier, now);
  const text = checkMentorNote(field(formData, "text"));
  const values = { text: keepTyped(text.value) };
  if (text.error) {
    await writeFormState(noteForm(shop.slug), { errors: [text.error], values, notice: null }, now);
    done(`${path}#mentor-${shop.slug}-add-note`);
  }
  await takeOnce(once, now, { form: noteForm(shop.slug), values, path: `${path}#mentor-${shop.slug}-add-note` }, notes);
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
  await leaveOnceToken(once, { path: notes, notice: "note-added" }, now);
  await leaveNotice("note-added", now);
  done(notes);
}

/** Add a check-in (spec 2.6): its date, today or earlier in SAST, and what was said. */
export async function addCheckIn(formData: FormData): Promise<void> {
  const now = new Date();
  const { account, shop } = await mentoredFrom(formData, now);
  const path = mentorShopPath(shop.slug);
  const notes = `${path}#mentor-${shop.slug}-notes`;
  const here = `${path}#mentor-${shop.slug}-add-check-in`;
  const once = field(formData, "once");
  const earlier = await sentOnceToken(once, now);
  if (earlier) await sentAgain(earlier, now);
  const day = checkCheckInDay(field(formData, "day"), sastDate(now));
  const text = checkMentorNote(field(formData, "text"));
  const errors = [day.error, text.error].filter((error): error is NonNullable<typeof error> => error !== null);
  const values = { day: keepTyped(field(formData, "day")), text: keepTyped(text.value) };
  if (errors.length > 0) {
    await writeFormState(checkInForm(shop.slug), { errors, values, notice: null }, now);
    done(here);
  }
  await takeOnce(once, now, { form: checkInForm(shop.slug), values, path: here }, notes);
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
  await leaveOnceToken(once, { path: notes, notice: "check-in-added" }, now);
  await leaveNotice("check-in-added", now);
  done(notes);
}
