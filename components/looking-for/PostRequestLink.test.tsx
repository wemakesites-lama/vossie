import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PostRequestLink } from "./PostRequestLink";
import { PostRequestLinkView } from "./PostRequestLinkView";

// The session's part never arrives here, so what renders is the static shell's fallback (plan, Task 16).
vi.mock("./ViewerPostRequestLink", async () => {
  const { use } = await import("react");
  const never = new Promise<never>(() => {});
  return { ViewerPostRequestLink: () => use(never) };
});

describe("Post a request follows the session (community actions spec section 3, plan, Task 16)", () => {
  it("is the sign-in link in the static shell, coming back to the form, with the caller's look", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<PostRequestLink className="btn btn-primary board-post">Post a request</PostRequestLink>);
    const link = within(container).getByRole("link", { name: "Post a request" });
    expect(link).toHaveAttribute("href", "/login?next=%2Flooking-for%2Fnew");
    expect(link).toHaveClass("btn", "btn-primary", "board-post");
  });

  it("is the form's own address once the visitor is signed in, in the same box", () => {
    const { unmount } = render(
      <PostRequestLinkView signedIn={false} className="btn btn-primary">
        Post a request
      </PostRequestLinkView>,
    );
    const signedOut = screen.getByRole("link", { name: "Post a request" });
    expect(signedOut).toHaveAttribute("href", "/login?next=%2Flooking-for%2Fnew");
    const outerSignedOut = signedOut.outerHTML.replace(/href="[^"]*"/, "");
    unmount();

    render(
      <PostRequestLinkView signedIn className="btn btn-primary">
        Post a request
      </PostRequestLinkView>,
    );
    const signedIn = screen.getByRole("link", { name: "Post a request" });
    expect(signedIn).toHaveAttribute("href", "/looking-for/new");
    // Only the address differs, so the link's box is the same and nothing moves when the session's part streams in.
    expect(signedIn.outerHTML.replace(/href="[^"]*"/, "")).toBe(outerSignedOut);
  });
});
