import { describe } from "vitest";
import { sampleWorld } from "@/tests/contract/sample-world";
import { messagesReadContract } from "./messages-read.contract";

describe("messages, the reads, on the sample store (C2/C3 plan Task 14)", () => {
  messagesReadContract(sampleWorld);
});
