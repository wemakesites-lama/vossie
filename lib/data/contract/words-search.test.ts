import { describe } from "vitest";
import { sampleStore } from "@/lib/data/store";
import { wordsSearchContract } from "./words-search.contract";

describe("the words search's daily cap on the sample store (AI stage E, Task 4)", () => {
  wordsSearchContract(() => sampleStore().wordsSearchParses.clear());
});
