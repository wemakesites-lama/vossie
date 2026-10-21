import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { formStatesContract } from "./form-states.contract";

describe("one-time tokens on the sample store (C4/C5 plan Task 2)", () => {
  formStatesContract(sampleWorld);
});
