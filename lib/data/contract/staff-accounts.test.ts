import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { staffAccountsContract } from "./staff-accounts.contract";

describe("staff accounts' data on the sample store (C4/C5 plan Task 20)", () => {
  staffAccountsContract(sampleWorld);
});
