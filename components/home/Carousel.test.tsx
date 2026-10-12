import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "@/tests/helpers/dom";
import { Carousel } from "./Carousel";

const scrollBy = vi.fn();

beforeEach(() => {
  // jsdom can't scroll elements.
  Object.defineProperty(HTMLElement.prototype, "scrollBy", { configurable: true, writable: true, value: scrollBy });
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(1000);
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollBy");
});

function renderCarousel() {
  return render(
    <Carousel label="Categories" header={<h2>Shop by category</h2>}>
      <li>
        <Link href="/categories/tech">Tech</Link>
      </li>
      <li>
        <Link href="/categories/food">Food</Link>
      </li>
    </Carousel>,
  );
}

describe("Carousel", () => {
  it("is a labelled carousel region holding its slides and header", () => {
    renderCarousel();
    const region = screen.getByRole("region", { name: "Categories" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
    expect(within(region).getAllByRole("listitem")).toHaveLength(2);
    expect(within(region).getByRole("heading", { name: "Shop by category" })).toBeInTheDocument();
  });

  it("names its buttons after what it shows, with Previous unavailable at the start", () => {
    renderCarousel();
    expect(screen.getByRole("button", { name: "Previous categories" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Next categories" })).toHaveAttribute("aria-disabled", "false");
  });

  it("scrolls most of a view smoothly, or straight there with reduced motion", async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(screen.getByRole("button", { name: "Next categories" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 850, behavior: "smooth" });

    mockMatchMedia((query) => query.includes("reduce"));
    await user.click(screen.getByRole("button", { name: "Next categories" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 850, behavior: "auto" });
  });

  it("leaves out the arrows and bar when asked", () => {
    render(
      <Carousel label="Sellers" controls={false}>
        <li>One</li>
      </Carousel>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
