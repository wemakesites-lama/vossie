/**
 * A one-off confirmation after a Server Action redirects (accounts plan decision 12). The cookie holds a code, never
 * words, so it can't put its own text on the page; it's readable, so the toast can delete it once shown.
 */
export const FLASH_COOKIE = "vossie_flash";

const FLASH_MESSAGES = {
  "signed-out": "You're signed out",
  deleted: "Your account has been deleted",
} as const;

export type FlashCode = keyof typeof FLASH_MESSAGES;

/** The words for a flash code, or null for anything else. */
export function flashMessage(code: string | null | undefined): string | null {
  return code && Object.hasOwn(FLASH_MESSAGES, code) ? FLASH_MESSAGES[code as FlashCode] : null;
}
