import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";

describe("icons", () => {
  it("exports the site's icon set", () => {
    expect(Object.keys(icons).sort()).toEqual([
      "ArrowLeftIcon",
      "ArrowRightIcon",
      "ArrowUpRightIcon",
      "BagIcon",
      "CheckIcon",
      "ChevronDownIcon",
      "ChevronLeftIcon",
      "ChevronRightIcon",
      "ClockIcon",
      "CloseIcon",
      "FlagIcon",
      "HeartIcon",
      "HomeIcon",
      "MapPinIcon",
      "MenuIcon",
      "MessageIcon",
      "PauseIcon",
      "PlayIcon",
      "PlusIcon",
      "PlusSquareIcon",
      "SearchIcon",
      "ShareIcon",
      "ShieldIcon",
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
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg?.querySelector("path, circle, rect")).not.toBeNull();
  });

  it("passes extra props through", () => {
    const { container } = render(<icons.HeartIcon className="size-5" />);
    expect(container.querySelector("svg")).toHaveClass("size-5");
  });

  it("stays hidden from screen readers even if a caller tries to un-hide it", () => {
    const { container } = render(<icons.HeartIcon {...({ "aria-hidden": false, focusable: "true" } as object)} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("lets callers change the size", () => {
    const { container } = render(<icons.HeartIcon width={16} height={16} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "16");
  });
});
