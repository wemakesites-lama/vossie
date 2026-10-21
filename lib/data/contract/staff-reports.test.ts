import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { staffReportsContract } from "./staff-reports.contract";

describe("the reports queue and Show again's reads on the sample store (C4/C5 plan Task 15)", () => {
  staffReportsContract(sampleWorld);
});
