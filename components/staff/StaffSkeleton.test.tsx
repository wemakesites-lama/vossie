import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STAFF_SKELETON_HTML } from "@/tests/e2e/helpers/staff-skeleton";
import { StaffSkeleton } from "./StaffSkeleton";

describe("StaffSkeleton", () => {
  it("draws the eyebrow, title, nav and body, with no words", () => {
    const { container } = render(<StaffSkeleton />);
    for (const part of ["eyebrow", "title", "nav", "body"]) {
      expect(container.querySelector(`.staff-skeleton-${part}`)).not.toBeNull();
    }
    expect(container).toHaveTextContent("");
  });

  it("leaves out the body when short, for the confirm pages that are shorter than the full shell", () => {
    const { container } = render(<StaffSkeleton short />);
    for (const part of ["eyebrow", "title", "nav"]) {
      expect(container.querySelector(`.staff-skeleton-${part}`)).not.toBeNull();
    }
    expect(container.querySelector(".staff-skeleton-body")).toBeNull();
  });

  it("matches the copy the end-to-end height checks inject (role views N3)", () => {
    expect(renderToStaticMarkup(<StaffSkeleton />)).toBe(STAFF_SKELETON_HTML);
  });
});
