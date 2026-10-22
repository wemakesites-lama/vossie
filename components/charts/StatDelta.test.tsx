import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatDelta } from "./StatDelta";

describe("StatDelta", () => {
  it("says a rise in words, with an arrow and a sign", () => {
    const { container } = render(<StatDelta now={9} previous={6} />);
    expect(container.querySelector(".stat-delta")).toHaveTextContent("↑ 3 on last week");
  });

  it("can't compare when either side is masked or missing", () => {
    const { rerender } = render(<StatDelta now="under5" previous={7} />);
    expect(screen.getByText("Can't compare")).toBeInTheDocument();
    rerender(<StatDelta now={7} previous="hidden" />);
    expect(screen.getByText("Can't compare")).toBeInTheDocument();
    rerender(<StatDelta now={7} previous={null} />);
    expect(screen.getByText("Can't compare")).toBeInTheDocument();
  });
});
