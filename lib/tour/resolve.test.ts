import { afterEach, describe, expect, it } from "vitest";
import { finderFor, findTourPage, pickTarget, resolveSteps } from "./resolve";

const shown = (element: Element) => element.closest("[hidden]") === null;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findTourPage (guided tour spec 6.1)", () => {
  it("takes the page that's showing, not one Next kept hidden", () => {
    document.body.innerHTML = `
      <div hidden><div data-tour-page="browse"></div></div>
      <div data-tour-page="home"></div>`;
    expect(findTourPage(document, shown)?.id).toBe("home");
  });

  it("ignores an unknown tour id", () => {
    document.body.innerHTML = `<div data-tour-page="nope"></div>`;
    expect(findTourPage(document, shown)).toBeNull();
  });

  it("finds nothing on a page without a tour", () => {
    document.body.innerHTML = `<div class="page"></div>`;
    expect(findTourPage(document, shown)).toBeNull();
  });
});

describe("finderFor", () => {
  it("looks in the page, then in the shared header, tab bar and section shell", () => {
    document.body.innerHTML = `
      <header class="site-header"><button data-tour="search"></button></header>
      <div data-tour-page="home"><div data-tour="hero-campus"></div></div>
      <nav class="tabbar"><a data-tour="tab-shop"></a></nav>
      <div class="other"><a data-tour="tab-saved"></a></div>`;
    const page = findTourPage(document, shown)!.page;
    const find = finderFor(document, page, shown);
    expect(find("search")).not.toBeNull();
    expect(find("hero-campus")).not.toBeNull();
    expect(find("tab-shop")).not.toBeNull();
    expect(find("tab-saved"), "outside the page and the chrome").toBeNull();
  });

  it("skips a copy that's off screen and takes the one showing", () => {
    document.body.innerHTML = `
      <div data-tour-page="sell">
        <nav hidden data-tour="sell-bar" id="side"></nav>
        <nav data-tour="sell-bar" id="bar"></nav>
      </div>`;
    const find = finderFor(document, findTourPage(document, shown)!.page, shown);
    expect(find("sell-bar")?.id).toBe("bar");
  });
});

describe("pickTarget and resolveSteps (spec 3.3)", () => {
  function setUp() {
    document.body.innerHTML = `
      <header class="site-header"><button data-tour="search"></button><a data-tour="hdr-sell" hidden></a></header>
      <div data-tour-page="home"></div>
      <nav class="tabbar"><a data-tour="tab-myshop"></a></nav>`;
    return finderFor(document, findTourPage(document, shown)!.page, shown);
  }

  it("takes the first target on screen from a list", () => {
    const find = setUp();
    expect(pickTarget(["tab-sell", "hdr-sell", "tab-myshop"], find)?.dataset.tour).toBe("tab-myshop");
  });

  it("drops a step whose part isn't on screen, keeping the order", () => {
    const find = setUp();
    const steps = [
      { target: "search" as const, title: "a" },
      { target: ["tab-sell", "hdr-sell"] as const, title: "b" },
      { target: "tab-myshop" as const, title: "c" },
    ];
    expect(resolveSteps(steps, find).map(({ step }) => step.title)).toEqual(["a", "c"]);
  });
});
