import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";

describe("icons", () => {
  it("exports the shell's icon set", () => {
    expect(Object.keys(icons).sort()).toEqual([
      "ArrowLeftIcon",
      "ArrowUpRightIcon",
      "CheckIcon",
      "ChevronDownIcon",
      "ChevronRightIcon",
      "ClockIcon",
      "CloseIcon",
      "HeartIcon",
      "MapPinIcon",
      "MenuIcon",
      "PauseIcon",
      "PlayIcon",
      "PlusSquareIcon",
      "SearchIcon",
      "ShareIcon",
      "TrendingIcon",
      "UserIcon",
    ]);
  });

  it.each(Object.entries(icons))("%s is a decorative 24px stroke icon", (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("stroke-width", "1.8");
  });

  it("passes extra props through", () => {
    const { container } = render(<icons.HeartIcon className="size-5" />);
    expect(container.querySelector("svg")).toHaveClass("size-5");
  });
});
