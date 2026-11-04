import "server-only";
import type * as Sample from "../words-search";
import { forServer } from "./clients";

// The words search's site-wide daily cap on Supabase (AI stage E plan decision 5). private.words_search_parses is
// reached only through public.reserve_words_search, granted to the service role. The day is the database's, in SAST.

function failed(fn: string, error: { code?: string } | null): never {
  throw new Error(`${fn} failed (${error?.code ?? "unknown"})`);
}

/** One of today's parses (SAST, on the database's clock) while under `cap`. A failure throws: Browse searches as typed. */
export const reserveWordsSearch: typeof Sample.reserveWordsSearch = async (_now, cap) => {
  const { data, error } = await forServer().rpc("reserve_words_search", { p_max_parses: cap });
  if (error) failed("reserve_words_search", error);
  return data === true;
};
