"use client";

import { useEffect } from "react";
import { preferenceCookie } from "@/lib/cookies";
import { FLASH_COOKIE } from "@/lib/flash";
import { showToast } from "@/lib/toast";

/**
 * Shows a Server Action's one-off confirmation in the toast region (accounts plan decision 12), then deletes the flash
 * cookie so it shows once. The words come from the server, chosen from a fixed list by the cookie's code.
 */
export function FlashToast({ message }: { message: string }) {
  useEffect(() => {
    showToast(message);
    document.cookie = preferenceCookie(FLASH_COOKIE, "", window.location.protocol === "https:");
  }, [message]);
  return null;
}
