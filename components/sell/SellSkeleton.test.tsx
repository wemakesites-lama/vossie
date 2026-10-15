import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeleteListingPage from "@/app/sell/listings/[id]/delete/page";
import { SellDeleteSkeleton, SellFormSkeleton, SellSkeleton } from "./SellSkeleton";

// The confirmation's content never arrives in this test: it suspends, so the page shows what it shows while it streams.
vi.mock("@/components/sell/DeleteListing", () => ({
  DeleteListing: () => {
    throw new Promise(() => {});
  },
}));

describe("the selling skeletons (selling plan, Task 17)", () => {
  it("hide themselves from assistive technology", () => {
    for (const skeleton of [<SellSkeleton key="a" />, <SellFormSkeleton key="b" />, <SellDeleteSkeleton key="c" />]) {
      const { container, unmount } = render(skeleton);
      expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
      unmount();
    }
  });

  it("show Delete listing's own size while its confirmation streams in, not a form's (amendment 10.8)", () => {
    const { container } = render(<DeleteListingPage params={Promise.resolve({ id: "l-sample" })} searchParams={Promise.resolve({})} />);
    expect(container.querySelector(".sell-skeleton-delete")).not.toBeNull();
    expect(container.querySelector(".sell-skeleton-form")).toBeNull();
  });
});
