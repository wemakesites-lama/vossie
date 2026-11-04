import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { reportReadContract } from "./report-read.contract";

describe("the report read on the sample store (AI stage C, Task 3)", () => {
  reportReadContract(sampleWorld);
});
