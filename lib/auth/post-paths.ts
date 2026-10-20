// The paths of the Route Handlers that start or end a session (stage K plan decision 12). Plain strings, so a Server
// Component can post a form to one without importing server code.

/** Signing out (Lama, 2026-10-20). */
export const SIGN_OUT_PATH = "/logout";

/** Deleting the account (stage K decision 54), a post from the privacy settings page. */
export const DELETE_ACCOUNT_PATH = "/account/privacy/delete";

/** The three posts that start a session (stage K spec decision 2): step 2's code, step 3's profile, a sample account. */
export const SIGN_IN_POSTS = { code: "/login/code", profile: "/login/profile", sample: "/login/sample" } as const;
