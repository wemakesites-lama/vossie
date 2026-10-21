import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { notificationsContract } from "./notifications.contract";

describe("notifications on the sample store (C2/C3 plan Task 12)", () => {
  notificationsContract(sampleWorld);
});
