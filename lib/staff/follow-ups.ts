import { onSupabase } from "@/lib/backend";

/**
 * A staff action's follow-ups after its write: the audit entry, the reports it closes and the notifications it sends
 * (staff tools plan decisions 6 and 23). On Supabase the staff function did all of them in its own transaction (spec
 * amendment 12.1), so they run on the sample store only (C4/C5 plan decision 3). The twins of recordAudit,
 * closeReportsOn and closeReportsAboutShop throw, so a follow-up left outside this fails in the database tests.
 */
export async function sampleFollowUps(work: () => Promise<void>): Promise<void> {
  if (onSupabase()) return;
  await work();
}
