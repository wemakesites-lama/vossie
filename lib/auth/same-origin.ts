// The Route Handlers that start or end a session (stage K spec decisions 2 and 3; plan decisions 10 and 11). Server
// Actions get Next's Origin check; Route Handlers get none, so each of ours calls isSameOrigin() before it reads the
// body or a cookie. Without it, another site could post a sample account's button and sign a visitor in (login CSRF),
// or sign them out.

/**
 * Whether the post came from a page on this site: its Origin header's host (with any port) must equal the first
 * x-forwarded-host when the host sets one, else the host header, which is Next's own rule.
 */
export function isSameOrigin(request: Pick<Request, "headers">): boolean {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host");
  if (!host) return false;
  // An Origin decides when there is one, and "null" is refused. Without one (proxy browsers such as Opera Mini, older
  // WebViews), the Referer must be a page on this host: a cross-site form can't forge it (plan decision 11, amended).
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source || source === "null") return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

/** The answer to a post from anywhere else. Nobody using Vossie ever sees it. */
export function notFromVossie(): Response {
  return new Response("This form must be sent from Vossie.", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * 303 See Other to a path on this site: the browser loads it as a new document with GET, so nothing from the page it
 * left survives (spec decision 2). A relative Location avoids building an address from the request behind a proxy.
 */
export function seeOther(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store" } });
}
