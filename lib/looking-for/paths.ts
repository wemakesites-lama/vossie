// Looking For's addresses (community actions spec section 3), the keys its forms and status lines keep their state
// under (D decision 3, plan decision 7), and the prefixes that keep its ids unique across kept pages (plan decision 2).

export const NEW_REQUEST_PATH = "/looking-for/new";
export const YOUR_REQUESTS_PATH = "/account/requests";

export const requestPath = (id: string) => `/looking-for/${id}`;
export const editRequestPath = (id: string) => `/looking-for/${id}/edit`;
export const deleteRequestPath = (id: string) => `/looking-for/${id}/delete`;
export const offerPath = (id: string) => `/looking-for/${id}/offer`;

/** The request form's state: the new request's, or one request's edit. */
export const requestFormKey = (id: string | null) => (id ? `request:${id}` : "request:new");
export const offerFormKey = (id: string) => `offer:${id}`;
/** A request page's status line, left by an action and taken once by the asker's panel (plan decision 7). */
export const requestNoteKey = (id: string) => `request-note:${id}`;
/** Your requests' status line. */
export const YOUR_REQUESTS_FORM = "your-requests";

export const requestFieldPrefix = (id: string | null) => (id ? `request-${id}` : "request-new");
export const offerFieldPrefix = (id: string) => `offer-${id}`;
