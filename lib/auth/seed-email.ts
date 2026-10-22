// The seed's sample accounts' addresses (supabase foundation plan, Task 11). No imports: scripts/seed-sql.ts loads it
// under plain Node, and the demo sign-in (lib/auth/sign-in-finish.ts) uses it to find the seed account a button names.

/** The reserved test domain of the seed's sample accounts (RFC 2606's .test: it can never be a real mailbox). */
export const SEED_ACCOUNT_DOMAIN = "vossie.test";

/**
 * A sample account's address in the seed: the fixture's own name on the test domain, so "student@eduvos.com" in sample
 * mode is "student@vossie.test" here. The fixtures stay as they are (sample mode uses them); seed accounts, admin and
 * mentor included, never look like someone's real Eduvos address.
 */
export function seedEmail(fixtureEmail: string): string {
  const at = fixtureEmail.lastIndexOf("@");
  if (at < 1) throw new Error(`Not an email address: ${fixtureEmail}`);
  return `${fixtureEmail.slice(0, at)}@${SEED_ACCOUNT_DOMAIN}`;
}
