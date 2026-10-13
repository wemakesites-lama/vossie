export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/**
 * Share a page (spec 5.8): the phone's share sheet where there is one, otherwise copy the link. Closing the share
 * sheet isn't a failure; any other share error falls back to copying.
 */
export async function shareLink(title: string, url: string): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
