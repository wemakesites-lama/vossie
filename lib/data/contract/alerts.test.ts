import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { alertsContract } from "./alerts.contract";

describe("saved searches and alerts on the sample store (C4/C5 plan Task 8)", () => {
  alertsContract(sampleWorld);
});
