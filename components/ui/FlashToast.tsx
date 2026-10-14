"use client";

import { useEffect } from "react";
import { preferenceCookie, readCookie } from "@/lib/cookies";
import { FLASH_COOKIE } from "@/lib/flash";
import { showToast } from "@/lib/toast";

/**
 * Shows a Server Action's one-off confirmation in the toast region (accounts plan decision 12), then deletes the flash
 * cookie so it shows once. The words come from the server, chosen from a fixed list by the cookie's code.
 */
export function FlashToast({ message }: { message: string }) {
  useEffect(() => {
    // Next keeps recent pages in a hidden <Activity> and shows them again on a link or Back, which runs this effect
    // again. The cookie is gone once the toast has shown, so a missing cookie means it already did.
    if (readCookie(document.cookie, FLASH_COOKIE) === null) return;
    showToast(message);
    document.cookie = preferenceCookie(FLASH_COOKIE, "", window.location.protocol === "https:");
  }, [message]);
  return null;
}
