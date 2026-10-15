import { PHOTOS_PER_LISTING } from "@/lib/photos/rules";

// The listing form's photo order (selling spec 2.5 and section 4, plan decision 9). The form posts one `photo` field
// per photo, in order: a saved photo's address, or "new:<n>" for the n-th file in its file input. Its buttons post
// `photoMove`, "<photo>:earlier", ":later", ":cover" or ":remove".

export type PhotoOp = "earlier" | "later" | "cover" | "remove";
export type PhotoMove = { token: string; op: PhotoOp };

const OPS: readonly string[] = ["earlier", "later", "cover", "remove"];

export function newPhotoToken(index: number): string {
  return `new:${index}`;
}

export function newPhotoIndex(token: string): number | null {
  const match = /^new:(\d{1,2})$/.exec(token);
  return match ? Number(match[1]) : null;
}

/** A button's value as a move: the photo is everything before the last colon. */
export function parsePhotoMove(raw: string): PhotoMove | null {
  const at = raw.lastIndexOf(":");
  if (at <= 0) return null;
  const op = raw.slice(at + 1);
  return OPS.includes(op) ? { token: raw.slice(0, at), op: op as PhotoOp } : null;
}

/** The order after a move. A photo that isn't there, or a move past either end, changes nothing. */
export function applyPhotoMove(order: readonly string[], move: PhotoMove): string[] {
  const from = order.indexOf(move.token);
  if (from === -1) return [...order];
  const next = order.filter((_, index) => index !== from);
  if (move.op === "remove") return next;
  const to =
    move.op === "cover" ? 0 : move.op === "earlier" ? Math.max(0, from - 1) : Math.min(order.length - 1, from + 1);
  next.splice(to, 0, move.token);
  return next;
}

/** A token as the address it stands for: "new:<n>" is the n-th stored upload's, or null when that one was refused. */
export function resolveToken(token: string, stored: readonly (string | null)[]): string | null {
  const index = newPhotoIndex(token);
  return index === null ? token : (stored[index] ?? null);
}

/**
 * The photos' final order (plan decision 9): each posted token that's allowed (a saved photo's address in `allowed`,
 * or an upload the server stored), then any stored upload no token named, with no repeats and at most 6.
 */
export function photoOrder(
  tokens: readonly string[],
  allowed: ReadonlySet<string>,
  stored: readonly (string | null)[],
): { order: string[]; tooMany: boolean } {
  const order: string[] = [];
  const add = (src: string | null) => {
    if (src && !order.includes(src)) order.push(src);
  };
  for (const token of tokens) {
    const src = resolveToken(token, stored);
    add(newPhotoIndex(token) !== null || (src && allowed.has(src)) ? src : null);
  }
  for (const src of stored) add(src);
  return { order: order.slice(0, PHOTOS_PER_LISTING), tooMany: order.length > PHOTOS_PER_LISTING };
}
