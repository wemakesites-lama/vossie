import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("Markdown (community spec decision 9)", () => {
  it("renders paragraphs, headings, bullets and numbers", () => {
    render(<Markdown source={"Intro line\n\n## Before you list\n- one\n- two\n\n1. first\n2. second"} />);
    expect(screen.getByText("Intro line").tagName).toBe("P");
    expect(screen.getByRole("heading", { level: 2, name: "Before you list" })).toBeInTheDocument();
    const [bullets, numbers] = screen.getAllByRole("list");
    expect(bullets.tagName).toBe("UL");
    expect(within(bullets).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["one", "two"]);
    expect(numbers.tagName).toBe("OL");
    expect(within(numbers).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["first", "second"]);
  });

  it("renders bold, italic and links inside the site", () => {
    const { container } = render(
      <Markdown source="Price it **fairly**, not *cheaply*. See [the safety tips](/safety)." />,
    );
    expect(container.querySelector("strong")).toHaveTextContent("fairly");
    expect(container.querySelector("em")).toHaveTextContent("cheaply");
    expect(screen.getByRole("link", { name: "the safety tips" })).toHaveAttribute("href", "/safety");
  });

  it("keeps the words of a link that leads off the site, but not the link", () => {
    render(<Markdown source="Read [this](https://evil.example) and [that](//evil.example)." />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Read this and that.")).toBeInTheDocument();
  });

  it("shows HTML as text, never as markup", () => {
    const { container } = render(<Markdown source={'<img src="x" onerror="alert(1)"> **<b>hi</b>**'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container).toHaveTextContent('<img src="x" onerror="alert(1)"> <b>hi</b>');
  });

  it("takes a class for where it sits", () => {
    const { container } = render(<Markdown source="Hello" className="hub-post-body" />);
    expect(container.firstChild).toHaveClass("markdown", "hub-post-body");
  });
});
