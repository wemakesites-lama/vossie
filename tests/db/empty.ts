// Stands in for "server-only" in `pnpm test:db` (vitest.db.config.mts): the package throws outside a React Server
// Components bundle, and the Supabase twins are plain modules in these tests.
export {};
