import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { INSTALL_PROMPT_EVENT } from "./install-event";

const ROOT = process.cwd();
const FOLDERS = ["app", "components", "hooks", "lib"];
/** Server code that client code must never reach (community actions plan, Task 21; amendment 5 and the cut rule). */
const SERVER_ONLY = ["lib/boot-script.ts", "lib/offline.ts"];

function sourceFiles(): string[] {
  return FOLDERS.flatMap((folder) =>
    (readdirSync(join(ROOT, folder), { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .map((file) => join(folder, file)),
  );
}

const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

/** The project file an import points at, or null for a package, a type-only path or anything outside the project. */
function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.startsWith(".")
      ? join(dirname(from), specifier)
      : null;
  if (base === null) return null;
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((candidate) => existsSync(join(ROOT, candidate))) ?? null;
}

function importsOf(file: string): string[] {
  const found = [...read(file).matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g)];
  return found.flatMap(([, specifier]) => resolveImport(file, specifier) ?? []);
}

describe("the install event's name (community actions plan, Task 21)", () => {
  it("is the one the boot script and the footer's install button share", () => {
    expect(INSTALL_PROMPT_EVENT).toBe("vossie:installprompt");
  });

  it("is in a module that imports nothing, so reaching it brings nothing else along", () => {
    expect(importsOf("lib/install-event.ts")).toEqual([]);
  });

  it("is imported by the install button's code and by the boot script, not through each other", () => {
    expect(importsOf("lib/install.ts")).toContain("lib/install-event.ts");
    expect(importsOf("lib/boot-script.ts")).toContain("lib/install-event.ts");
    expect(importsOf("lib/install.ts")).not.toContain("lib/boot-script.ts");
  });
});

describe("client code and the boot script (community actions plan, Task 21)", () => {
  it("never reaches lib/boot-script.ts or lib/offline.ts, however far its imports go", () => {
    // Importing them put none of the worker's text in a script file, yet made every page's JavaScript 527 B larger
    // (the chunks split differently: decision 63; see lib/install-event.ts). Everything a "use client" file or
    // lib/install.ts imports, and what those import in turn, must stay clear of them.
    const entries = sourceFiles().filter((file) => file === "lib/install.ts" || /^["']use client["']/m.test(read(file)));
    expect(entries.length).toBeGreaterThan(10);
    const reached = new Set<string>(entries);
    const queue = [...entries];
    while (queue.length > 0) {
      for (const next of importsOf(queue.pop()!)) {
        if (reached.has(next)) continue;
        reached.add(next);
        queue.push(next);
      }
    }
    // The walk does follow imports: it gets from lib/install.ts to the event's module.
    expect(reached.has("lib/install-event.ts")).toBe(true);
    for (const file of SERVER_ONLY) expect(reached.has(file), file).toBe(false);
  });
});
