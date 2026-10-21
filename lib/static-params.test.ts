import { describe, expect, it } from "vitest";
import { atLeastOne, PLACEHOLDER_PARAMS } from "./static-params";

describe("at least one value to prerender (2b plan Task 17b)", () => {
  it("gives the values when there are some, and the placeholder alone when there are none", () => {
    expect(atLeastOne([{ id: "a" }, { id: "b" }], { id: "x" })).toEqual([{ id: "a" }, { id: "b" }]);
    expect(atLeastOne([], { id: "x" })).toEqual([{ id: "x" }]);
  });

  it("uses placeholders no sample row has", () => {
    expect(Object.values(PLACEHOLDER_PARAMS).map((value) => Object.values(value)[0])).toEqual([
      "l-sample",
      "sample-shop",
      "sample-collection",
      "r-sample",
      "h-sample",
    ]);
  });
});
