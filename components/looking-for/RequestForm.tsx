import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses, getCategories } from "@/lib/data";
import { getOwnRequest } from "@/lib/data/requests";
import { editRequestPath, NEW_REQUEST_PATH, requestFieldPrefix, requestFormKey } from "@/lib/looking-for/paths";
import { issueOnceToken } from "@/lib/staff/once";
import { sastDate } from "@/lib/time";
import { RequestFormView, RequestLocked, requestForm, startValues } from "./RequestFormView";

/**
 * The request form for this request's visitor (community actions spec 2.3 and 2.6). Request-time: each page puts it
 * inside <Suspense>. Signed out: sign in, then come back. An edit is the asker's own request, or the 404; a closed or
 * hidden one says why it can't be changed (plan decision 6). A new request's form carries a one-time token, made here
 * after `connection()` (plan amendment 3).
 */
export async function RequestForm({ requestId }: { requestId: string | null }) {
  const account = await requireAccount(requestId ? editRequestPath(requestId) : NEW_REQUEST_PATH);
  const own = requestId ? await getOwnRequest(account.id, requestId) : null;
  if (requestId && !own) notFound();
  if (own && own.state !== "open") {
    return <RequestLocked requestId={own.request.id} title={own.request.title} state={own.state} />;
  }
  // The date's first and last days read the clock (decision 26), and so does the token.
  await connection();
  const today = sastDate(new Date());
  const [state, campuses, categories, once] = await Promise.all([
    readFormState(requestFormKey(requestId)),
    getCampuses(),
    getCategories(),
    requestId ? null : issueOnceToken(),
  ]);
  const form = requestForm(state, startValues(own?.request ?? null, account.campusSlug), requestFieldPrefix(requestId));
  return (
    <RequestFormView
      requestId={requestId}
      once={once}
      form={form}
      campuses={campuses}
      categories={categories}
      today={today}
    />
  );
}
