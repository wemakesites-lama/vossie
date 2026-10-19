import { describe, expect, it } from "vitest";
import {
  deleteRequestPath,
  editRequestPath,
  NEW_REQUEST_PATH,
  offerFieldPrefix,
  offerFormKey,
  offerPath,
  requestFieldPrefix,
  requestFormKey,
  requestNoteKey,
  requestPath,
  YOUR_REQUESTS_FORM,
  YOUR_REQUESTS_PATH,
} from "./paths";

describe("Looking For's addresses and form keys (community actions spec section 3, plan decisions 2 and 7)", () => {
  it("has a page for each action", () => {
    expect(NEW_REQUEST_PATH).toBe("/looking-for/new");
    expect(YOUR_REQUESTS_PATH).toBe("/account/requests");
    expect(requestPath("r-001")).toBe("/looking-for/r-001");
    expect(editRequestPath("r-001")).toBe("/looking-for/r-001/edit");
    expect(deleteRequestPath("r-001")).toBe("/looking-for/r-001/delete");
    expect(offerPath("r-001")).toBe("/looking-for/r-001/offer");
  });

  it("keeps each form's state, and each page's status line, apart", () => {
    expect(requestFormKey(null)).toBe("request:new");
    expect(requestFormKey("r-001")).toBe("request:r-001");
    expect(offerFormKey("r-001")).toBe("offer:r-001");
    expect(requestNoteKey("r-001")).toBe("request-note:r-001");
    expect(YOUR_REQUESTS_FORM).toBe("your-requests");
  });

  it("gives each form's ids a prefix of their own", () => {
    expect(requestFieldPrefix(null)).toBe("request-new");
    expect(requestFieldPrefix("r-001")).toBe("request-r-001");
    expect(offerFieldPrefix("r-001")).toBe("offer-r-001");
  });
});
