import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { mentorsContract } from "./mentors.contract";

describe("the mentor dashboard's data on the sample store (C4/C5 plan Task 19)", () => {
  mentorsContract(sampleWorld);
});
