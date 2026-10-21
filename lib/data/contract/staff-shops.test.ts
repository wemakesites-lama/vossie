import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { staffShopsContract } from "./staff-shops.contract";

describe("the Hub's shop decisions on the sample store (C4/C5 plan Task 14)", () => {
  staffShopsContract(sampleWorld);
});
