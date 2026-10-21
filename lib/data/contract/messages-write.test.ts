import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { messagesWriteContract } from "./messages-write.contract";

describe("messages, the writes, on the sample store (C2/C3 plan Task 15)", () => {
  messagesWriteContract(sampleWorld);
});
