import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { hubStaffContract } from "./hub-staff.contract";

describe("the Hub's staff side on the sample store (C4/C5 plan Task 18)", () => {
  hubStaffContract(sampleWorld);
});
