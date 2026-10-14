import { describe, expect, it } from "vitest";
import { flashMessage } from "./flash";

describe("flash messages (accounts plan decision 12)", () => {
  it("words the codes a Server Action can leave", () => {
    expect(flashMessage("signed-out")).toBe("You're signed out");
    expect(flashMessage("deleted")).toBe("Your account has been deleted");
  });

  it("ignores anything else, so the cookie can never put its own words on the page", () => {
    for (const code of [undefined, null, "", "toString", "<b>hi</b>", "Deleted"]) expect(flashMessage(code)).toBeNull();
  });
});
