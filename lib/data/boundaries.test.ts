import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Where Supabase may be reached from (2b plan decisions 15 and 16, Task 12, amendment 10). Static source checks over the
// files themselves, so they run in every `pnpm test` with nothing loaded:
// 1. client code never imports the data layer, Supabase or the backend switch;
// 2. a lib/data module reaches its Supabase twin only through import(), so sample mode never loads Supabase code;
// 3. every module under lib/data/supabase and lib/supabase starts with `import "server-only";`. That rule, not the
//    "use client" scan (which follows no imports), is what keeps the admin client out of a client bundle;
// 4. only lib/data/supabase, lib/supabase and the database tests' helpers (tests/db) import lib/supabase.
// Rules 2 and 4 ignore `import type` and `export type`, which leave nothing behind in the JavaScript.

const ROOT = process.cwd();
const SOURCE = /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/;
const TEST = /\.test\.tsx?$/;
const CLIENT = /^["']use client["']/m;
const SERVER_ONLY_FIRST = /^import "server-only";\r?\n/;

const LIB_SUPABASE = join(ROOT, "lib", "supabase");
const DATA = join(ROOT, "lib", "data");
const DATA_SUPABASE = join(ROOT, "lib", "data", "supabase");
const BACKEND = join(ROOT, "lib", "backend");
/** Who may import lib/supabase (rule 4). Phase B keeps lib/auth out: its Supabase code lives in lib/data/supabase. */
const MAY_IMPORT_LIB_SUPABASE = [DATA_SUPABASE, LIB_SUPABASE, join(ROOT, "tests", "db")];

type Import = { specifier: string; kind: "static" | "type" | "dynamic" };

/** Every module path `source` names: static imports and re-exports (type-only ones marked), side-effect imports, import() and require(). */
function importsIn(source: string): Import[] {
  const found: Import[] = [];
  for (const [, type, specifier] of source.matchAll(
    /(?:^|[\s;{}])(?:import|export)\s+(type\s+)?(?:[^"';]*?\s)?from\s*["']([^"']+)["']/g,
  )) {
    found.push({ specifier, kind: type ? "type" : "static" });
  }
  for (const [, specifier] of source.matchAll(/(?:^|[\s;{}])import\s*["']([^"']+)["']/g)) found.push({ specifier, kind: "static" });
  for (const [, specifier] of source.matchAll(/\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    found.push({ specifier, kind: "dynamic" });
  }
  return found;
}

/** Where a specifier written in `file` points: an absolute path for "@/…" and relative paths, else the package name. */
function target(specifier: string, file: string): string {
  if (specifier.startsWith("@/")) return join(ROOT, specifier.slice(2));
  if (specifier.startsWith(".")) return resolve(dirname(file), specifier);
  return specifier;
}

/** Whether `path` is `dir` itself (or a module of that name, as "lib/backend" for lib/backend.ts) or inside it. */
function within(path: string, dir: string): boolean {
  const bare = path.replace(/\.(tsx?|mts|cts|jsx?|mjs|cjs)$/, "");
  return bare === dir || path.startsWith(`${dir}/`);
}

const isSupabasePackage = (path: string) => path.startsWith("@supabase/");

/** The source files under `folder` (relative to the root), recursively. Tests left out unless asked for. */
function filesUnder(folder: string, { tests = false } = {}): string[] {
  const base = join(ROOT, folder);
  if (!existsSync(base)) return [];
  return (readdirSync(base, { recursive: true }) as string[])
    .filter((file) => SOURCE.test(file) && (tests || !TEST.test(file)))
    .map((file) => join(base, file))
    .filter((path) => statSync(path).isFile());
}

/** The project's own code: app, components, hooks, lib, scripts and tests, and the files at the root (proxy.ts). Not tests. */
function projectFiles(): string[] {
  const rootFiles = readdirSync(ROOT)
    .filter((file) => SOURCE.test(file) && !/\.config\./.test(file) && !/^vitest\./.test(file))
    .map((file) => join(ROOT, file));
  return [...["app", "components", "hooks", "lib", "scripts", "tests"].flatMap((folder) => filesUnder(folder)), ...rootFiles];
}

const read = (path: string) => readFileSync(path, "utf8");
const shown = (path: string) => relative(ROOT, path);

describe("the boundaries' own reading of imports", () => {
  const from = join(ROOT, "lib", "data", "index.ts");
  const kinds = (source: string) => importsIn(source).map(({ specifier, kind }) => `${kind} ${specifier}`);

  it("finds static imports, re-exports, side-effect imports, import() and require(), across lines", () => {
    expect(kinds(`import { a } from "./supabase/catalog";`)).toEqual(["static ./supabase/catalog"]);
    expect(kinds(`import {\n  a,\n  b,\n} from "@/lib/supabase/admin";`)).toEqual(["static @/lib/supabase/admin"]);
    expect(kinds(`import * as Sample from '../requests';`)).toEqual(["static ../requests"]);
    expect(kinds(`export { adminClient } from "@/lib/supabase/admin";`)).toEqual(["static @/lib/supabase/admin"]);
    expect(kinds(`export * from "./supabase/rows";`)).toEqual(["static ./supabase/rows"]);
    expect(kinds(`import "server-only";`)).toEqual(["static server-only"]);
    expect(kinds(`const { x } = await import("./supabase/catalog");`)).toEqual(["dynamic ./supabase/catalog"]);
    expect(kinds(`const m = require("@supabase/supabase-js");`)).toEqual(["dynamic @supabase/supabase-js"]);
  });

  it("marks import type and export type, and only those, as type-only", () => {
    expect(kinds(`import type { Database } from\n  "@/lib/supabase/database.types";`)).toEqual(["type @/lib/supabase/database.types"]);
    expect(kinds(`export type { Row } from "./supabase/rows";`)).toEqual(["type ./supabase/rows"]);
    expect(kinds(`import { type Row, iso } from "./supabase/rows";`)).toEqual(["static ./supabase/rows"]);
    expect(kinds(`import typeset from "./typeset";`)).toEqual(["static ./typeset"]);
  });

  it("resolves the alias and relative paths, and tells lib/supabase from lib/data/supabase and look-alikes", () => {
    expect(within(target("@/lib/supabase/admin", from), LIB_SUPABASE)).toBe(true);
    expect(within(target("../supabase", from), LIB_SUPABASE)).toBe(true);
    expect(within(target("./supabase/catalog", from), LIB_SUPABASE)).toBe(false);
    expect(within(target("./supabase/catalog", from), DATA_SUPABASE)).toBe(true);
    expect(within(target("../supabase-notes", from), LIB_SUPABASE)).toBe(false);
    expect(within(target("@/lib/backend", from), BACKEND)).toBe(true);
    expect(within(target("@/lib/backend.ts", from), BACKEND)).toBe(true);
    expect(within(target("@/lib/backend-notes", from), BACKEND)).toBe(false);
  });
});

describe("where Supabase may be reached from (2b plan Task 12)", () => {
  it("client code never imports the data layer, lib/supabase, Supabase's packages or the backend switch", () => {
    const clients = ["app", "components", "hooks", "lib"].flatMap((folder) => filesUnder(folder)).filter((path) => CLIENT.test(read(path)));
    expect(clients.length).toBeGreaterThan(10);
    const found: string[] = [];
    for (const path of clients) {
      for (const { specifier } of importsIn(read(path))) {
        const to = target(specifier, path);
        if (within(to, DATA) || within(to, LIB_SUPABASE) || isSupabasePackage(to) || within(to, BACKEND)) {
          found.push(`${shown(path)}: ${specifier}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("a lib/data module reaches Supabase only through import() of its twin, never a static import", () => {
    const modules = filesUnder("lib/data").filter((path) => !within(path, DATA_SUPABASE));
    expect(modules.length).toBeGreaterThan(20);
    const found: string[] = [];
    for (const path of modules) {
      for (const { specifier, kind } of importsIn(read(path))) {
        if (kind !== "static") continue;
        const to = target(specifier, path);
        if (within(to, DATA_SUPABASE) || within(to, LIB_SUPABASE) || isSupabasePackage(to)) found.push(`${shown(path)}: ${specifier}`);
      }
    }
    expect(found).toEqual([]);
  });

  it("every module under lib/data/supabase and lib/supabase starts with import \"server-only\" (types and tests aside)", () => {
    const modules = [...filesUnder("lib/data/supabase"), ...filesUnder("lib/supabase")].filter(
      (path) => !path.endsWith("/database.types.ts"),
    );
    expect(modules.length).toBeGreaterThan(6);
    expect(modules.filter((path) => !SERVER_ONLY_FIRST.test(read(path))).map(shown)).toEqual([]);
  });

  it("only lib/data/supabase, lib/supabase and tests/db import lib/supabase or Supabase's packages", () => {
    const found: string[] = [];
    for (const path of projectFiles()) {
      if (MAY_IMPORT_LIB_SUPABASE.some((dir) => within(path, dir))) continue;
      for (const { specifier, kind } of importsIn(read(path))) {
        if (kind === "type") continue;
        const to = target(specifier, path);
        if (within(to, LIB_SUPABASE) || isSupabasePackage(to)) found.push(`${shown(path)}: ${specifier}`);
      }
    }
    expect(found).toEqual([]);
  });
});
