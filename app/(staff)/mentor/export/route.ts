import { connection } from "next/server";
import { getCampuses } from "@/lib/data";
import { mentoredShops } from "@/lib/data/mentors";
import { requireStaff } from "@/lib/staff/access";
import { mentorCsv } from "@/lib/staff/mentor";
import { MENTOR_PATH } from "@/lib/staff/paths";
import { sastDate } from "@/lib/time";

/**
 * The mentor dashboard's table as a CSV file (staff tools spec 2.6, plan decision 17): the same role check as the
 * page (signed out, sign in and come back to the dashboard; anyone else, the 404), never cached, and a download. The
 * body is sent as `mentorCsv` makes it, byte-order mark and all (amendment 12.2).
 */
export async function GET(): Promise<Response> {
  const account = await requireStaff("mentor", MENTOR_PATH);
  // The 14 days and the file's date read the clock (decision 26).
  await connection();
  const now = new Date();
  const [rows, campuses] = await Promise.all([mentoredShops(account, now), getCampuses()]);
  const csv = mentorCsv(rows, new Map(campuses.map((campus) => [campus.slug, campus.name])));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campuscart-mentoring-${sastDate(now)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
