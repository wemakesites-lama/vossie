import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { reportsContract } from "./reports.contract";

describe("students' reports on the sample store (C2/C3 plan Task 13)", () => {
  reportsContract(sampleWorld);
});
