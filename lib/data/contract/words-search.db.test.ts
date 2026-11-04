import { describe } from "vitest";
import { sql } from "@/tests/db/sql";
import { wordsSearchContract } from "./words-search.contract";

// The words search's daily cap on the local stack (AI stage E, Task 4): public.reserve_words_search with the admin client.
// The count is site-wide, so it's forgotten as postgres around each test (the table is closed to every API role).

describe("the words search's daily cap on the local stack (AI stage E, Task 4)", () => {
  wordsSearchContract(() => {
    sql("delete from private.words_search_parses;");
  });
});
