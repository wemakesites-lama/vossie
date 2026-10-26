import { getViewer } from "@/lib/auth/session";
import { barFor } from "@/lib/nav/bar";
import { SavedLink } from "./SiteHeader";

/**
 * Saved's heart on phones, for every bar without a Saved tab (role bars spec 6): sellers, mentors and admins. From the
 * tablet step the header always shows its own heart. Request-time, inside <Suspense fallback={null}>; a failed lookup
 * counts as signed out, whose bar has Saved.
 */
export async function PhoneSaved() {
  const account = await getViewer().catch(() => null);
  if (barFor(account) === "student") return null;
  return <SavedLink className="hdr-item wide:hidden" />;
}
