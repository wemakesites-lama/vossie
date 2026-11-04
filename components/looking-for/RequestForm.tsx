import { notFound } from "next/navigation";
import { connection } from "next/server";
import { readFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses, getCategories } from "@/lib/data";
import { getOwnRequest } from "@/lib/data/requests";
import { editRequestPath, NEW_REQUEST_PATH, requestFieldPrefix, requestFormKey } from "@/lib/looking-for/paths";
import { issueOnceToken } from "@/lib/staff/once";
import { sastDate } from "@/lib/time";
import { RequestFormView, RequestLocked, requestForm, startValues, titleFromLink } from "./RequestFormView";

/**
 * The request form for this request's visitor (community actions spec 2.3 and 2.6). Request-time: each page puts it
 * inside <Suspense>. Signed out: sign in, then come back. An edit is the asker's own request, or the 404; a closed or
 * hidden one says why it can't be changed (plan decision 6). A new request's form carries a one-time token, made here
 * after `connection()` (plan amendment 3). A new request's page may pass its `searchParams`: a `title` there starts the
 * form's title, and the sign-in bounce keeps it (stage D planning decision 3).
 */
export async function RequestForm({
  requestId,
  searchParams,
}: {
  requestId: string | null;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const title = !requestId && searchParams ? titleFromLink((await searchParams).title) : "";
  const newPath = title ? `${NEW_REQUEST_PATH}?title=${encodeURIComponent(title)}` : NEW_REQUEST_PATH;
  const account = await requireAccount(requestId ? editRequestPath(requestId) : newPath);
  // The date's first and last days, the token and whether the request has closed itself all read the clock (decision
  // 26; stage L spec decision 11), so connection() comes before the request is read.
  await connection();
  const now = new Date();
  const own = requestId ? await getOwnRequest(account.id, requestId, now) : null;
  if (requestId && !own) notFound();
  if (own && own.state !== "open") {
    return (
      <RequestLocked
        requestId={own.request.id}
        title={own.request.title}
        state={own.state}
        reopenClearsDate={own.neededByPassed}
      />
    );
  }
  const today = sastDate(now);
  const [state, campuses, categories, once] = await Promise.all([
    readFormState(requestFormKey(requestId)),
    getCampuses(),
    getCategories(),
    requestId ? null : issueOnceToken(),
  ]);
  const form = requestForm(state, startValues(own?.request ?? null, account.campusSlug, title), requestFieldPrefix(requestId));
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
