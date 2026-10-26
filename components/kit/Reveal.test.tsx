import { Suspense, ViewTransition, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { Reveal } from "./Reveal";

type Props = { fallback?: ReactElement<Props>; children?: ReactElement; exit?: string; enter?: string; default?: string };

// Like SavedTabs' test, the boundary is checked by its shape: suspending for real needs the App Router's streaming.
describe("Reveal (calm navigation spec 4, layer 2)", () => {
  const outline = <div>Outline</div>;
  const content = <p>Content</p>;
  const element = Reveal({ fallback: outline, children: content }) as ReactElement<Props>;

  it("is a Suspense boundary", () => {
    expect(element.type).toBe(Suspense);
  });

  it("fades the outline out, and nothing else", () => {
    const fallback = element.props.fallback!;
    expect(fallback.type).toBe(ViewTransition);
    expect(fallback.props).toMatchObject({ exit: "reveal-out", default: "none" });
    expect(fallback.props.children).toBe(outline);
  });

  it("fades the content in, and nothing else", () => {
    const wrapper = element.props.children as ReactElement<Props>;
    expect(wrapper.type).toBe(ViewTransition);
    expect(wrapper.props).toMatchObject({ enter: "reveal-in", default: "none" });
    expect(wrapper.props.children).toBe(content);
  });
});
