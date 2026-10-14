import { cookies } from "next/headers";
import { Suspense } from "react";
import { FLASH_COOKIE, flashMessage } from "@/lib/flash";
import { FlashToast } from "./FlashToast";

/**
 * The toast a Server Action asked for before redirecting here (accounts plan decision 12). It reads the flash cookie
 * per request, so it sits in its own <Suspense>, and it takes no room on the page.
 */
export function Flash() {
  return (
    <Suspense fallback={null}>
      <FlashContent />
    </Suspense>
  );
}

export async function FlashContent() {
  const message = flashMessage((await cookies()).get(FLASH_COOKIE)?.value);
  return message ? <FlashToast message={message} /> : null;
}
