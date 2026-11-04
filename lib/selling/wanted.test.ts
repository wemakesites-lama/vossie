import { describe, expect, it } from "vitest";
import { readWanted, wantedValues } from "./wanted";

describe("the notice's wanted values (planning decision 8)", () => {
  it("writes the count and up to three ids, and nothing for no students", () => {
    expect(wantedValues({ students: 4, requests: [{ id: "r-a", title: "A" }, { id: "r-b", title: "B" }] })).toEqual({
      wanted: "4",
      wantedIds: "r-a r-b",
    });
    expect(wantedValues({ students: 0, requests: [] })).toEqual({});
    expect(wantedValues(null)).toEqual({});
  });
  it("reads them back, refusing anything a form could have made up", () => {
    expect(readWanted({ listing: "l-1", wanted: "2", wantedIds: "r-a r-b" })).toEqual({ students: 2, ids: ["r-a", "r-b"] });
    expect(readWanted({ wanted: "2", wantedIds: "r-a R-B ../x r-c r-d r-e" })).toEqual({ students: 2, ids: ["r-a", "r-c", "r-d"] });
    expect(readWanted({ wanted: "0", wantedIds: "r-a" })).toBeNull();
    expect(readWanted({ wanted: "1.5", wantedIds: "r-a" })).toBeNull();
    expect(readWanted({ wanted: "2", wantedIds: "" })).toBeNull();
    expect(readWanted({ listing: "l-1" })).toBeNull();
    expect(readWanted(undefined)).toBeNull();
  });
});
