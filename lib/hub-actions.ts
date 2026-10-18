"use server";

import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { addRsvp, removeRsvp, requestSlot } from "@/lib/data/hub-posts";
import { notify } from "@/lib/data/notifications";
import { hubChanged } from "@/lib/data/tags";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field } from "@/lib/selling/action-helpers";
import { clearStaffForm, HUB_NOTICE, leaveNotice, slotForm } from "@/lib/staff/form-state";
import { slotRequestedText } from "@/lib/staff/notification-text";
import { bookSlotPath, HUB_MANAGE_PATH } from "@/lib/staff/paths";
import { checkHelp, checkTime } from "@/lib/staff/rules";
import { sastDate } from "@/lib/time";

// A student's RSVP and slot request (staff tools spec 2.5, plan decision 13). Plain forms, so they work before the
// app's JavaScript arrives. Signed out, each goes to sign-in and comes back. Identity comes only from the session;
// errors stay in D's form state; each ends with done(): refresh, then a replace redirect.

const postPath = (id: string) => `/hub/${id}`;

function postFrom(formData: FormData): string | null {
  const id = field(formData, "post");
  return isId(id) ? id : null;
}

/** RSVP: the student is going, and the event's count moves (the Hub's cached posts are expired). */
export async function rsvpToEvent(formData: FormData): Promise<void> {
  const id = postFrom(formData);
  if (!id) done("/hub");
  const account = await requireAccount(postPath(id));
  const now = new Date();
  const result = await addRsvp(id, account.id, sastDate(now), now);
  if (result === "going") hubChanged();
  if (result === "going" || result === "full") {
    await leaveNotice(result === "going" ? "rsvp" : "event-full", now, HUB_NOTICE);
  }
  done(postPath(id));
}

/** Cancel my RSVP. */
export async function cancelRsvp(formData: FormData): Promise<void> {
  const id = postFrom(formData);
  if (!id) done("/hub");
  const account = await requireAccount(postPath(id));
  const now = new Date();
  if (await removeRsvp(id, account.id)) {
    hubChanged();
    await leaveNotice("rsvp-cancelled", now, HUB_NOTICE);
  }
  done(postPath(id));
}

/**
 * Request a slot (spec 2.5): what they'd like help with (up to 300 characters) and, if they like, a time that suits
 * (up to 100). One open request per student per office hours; the post's author is told (FUNCTION-MAP I2).
 */
export async function sendSlotRequest(formData: FormData): Promise<void> {
  const id = postFrom(formData);
  if (!id) done("/hub");
  const path = bookSlotPath(id);
  const account = await requireAccount(path);
  const now = new Date();
  const help = checkHelp(field(formData, "help"));
  const time = checkTime(field(formData, "time"));
  const errors = [help.error, time.error].filter((error): error is NonNullable<typeof error> => error !== null);
  if (errors.length > 0) {
    const values = { help: keepTyped(help.value), time: keepTyped(time.value) };
    await writeFormState(slotForm(id), { errors, values, notice: null }, now);
    done(path);
  }
  const made = await requestSlot({
    postId: id,
    accountId: account.id,
    help: help.value,
    time: time.value,
    today: sastDate(now),
    now,
  });
  // The post says the office hours have passed; the request page says where an open request stands.
  if (made === "closed") done(postPath(id));
  if (made === "open-already") done(path);
  if (made.authorId && made.authorId !== account.id) {
    await notify({
      accountId: made.authorId,
      kind: "booking",
      subjectId: made.booking.id,
      text: slotRequestedText(account.firstName, made.postTitle),
      href: `${HUB_MANAGE_PATH}#hub-queue`,
      now,
    });
  }
  await clearStaffForm(slotForm(id));
  await leaveNotice("slot-requested", now, HUB_NOTICE);
  done(path);
}
