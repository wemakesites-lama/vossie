import { sampleAccounts } from "@/data/fixtures/accounts";
import type { Account } from "@/lib/types";
import { isSampleMode } from "./config";

// The five sample accounts (accounts spec 2.8). Every end-to-end project and every demo shares them, so they're exempt
// from the message limits while sample mode is on (stage K spec decision 10). Sample mode, and with it the exemption,
// goes at launch.

const SAMPLE_EMAILS: ReadonlySet<string> = new Set(sampleAccounts.map(({ account }) => account.email));

/** Whether the account is one of the five fixtures', in sample mode. Never true with sample mode off. */
export function isSampleAccount(account: Pick<Account, "email">): boolean {
  return isSampleMode() && SAMPLE_EMAILS.has(account.email);
}
