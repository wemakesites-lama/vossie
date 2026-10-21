import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// Source checks over the staff actions (C4/C5 plan Task 12): the files are read and parsed with TypeScript's own parser,
// so a check looks at each call's place in the code, never at a line of text.

/** The repository's root: tests run from it. */
export const ROOT = process.cwd();

/** The staff action files: lib/staff/*-actions.ts (not their tests), and the student's lib/hub-actions.ts. */
export function staffActionFiles(): string[] {
  const staff = readdirSync(join(ROOT, "lib/staff"))
    .filter((name) => name.endsWith("-actions.ts"))
    .map((name) => `lib/staff/${name}`);
  return [...staff, "lib/hub-actions.ts"];
}

/** A file, parsed, with its parents set. */
export function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(join(ROOT, path), "utf8"), ts.ScriptTarget.Latest, true);
}

/** The name a call calls, when it's a plain identifier (`notify(…)`), else null. */
export function calleeName(call: ts.CallExpression): string | null {
  return ts.isIdentifier(call.expression) ? call.expression.text : null;
}

/** Every call in the file, in source order. */
export function callsIn(node: ts.Node): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child)) calls.push(child);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return calls;
}

/** Whether `node` sits inside a callback passed to a call of `wrapper` (`sampleFollowUps(async () => { … })`). */
export function insideCallbackOf(node: ts.Node, wrapper: string): boolean {
  for (let at: ts.Node | undefined = node.parent; at; at = at.parent) {
    if (
      (ts.isArrowFunction(at) || ts.isFunctionExpression(at)) &&
      at.parent &&
      ts.isCallExpression(at.parent) &&
      calleeName(at.parent) === wrapper &&
      at.parent.arguments.includes(at as ts.Expression)
    ) {
      return true;
    }
  }
  return false;
}

/** The name of the function declaration `node` sits in, or null at the top level. */
export function enclosingFunctionName(node: ts.Node): string | null {
  for (let at: ts.Node | undefined = node.parent; at; at = at.parent) {
    if (ts.isFunctionDeclaration(at)) return at.name?.text ?? null;
  }
  return null;
}

/** The file's function declarations by name, exported or not. */
export function functionsIn(file: ts.SourceFile): Map<string, ts.FunctionDeclaration> {
  const functions = new Map<string, ts.FunctionDeclaration>();
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) functions.set(statement.name.text, statement);
  }
  return functions;
}

/** Whether a declaration is exported. */
export function isExported(declaration: ts.FunctionDeclaration): boolean {
  return (ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Export) !== 0;
}

/** The first awaited expression in a function's body, in source order (depth first), or null when it awaits nothing. */
export function firstAwait(declaration: ts.FunctionDeclaration): ts.Expression | null {
  let found: ts.Expression | null = null;
  const visit = (child: ts.Node) => {
    if (found) return;
    // A nested function's awaits aren't this function's.
    if (ts.isArrowFunction(child) || ts.isFunctionExpression(child) || ts.isFunctionDeclaration(child)) return;
    if (ts.isAwaitExpression(child)) {
      found = child.expression;
      return;
    }
    ts.forEachChild(child, visit);
  };
  if (declaration.body) ts.forEachChild(declaration.body, visit);
  return found;
}

/**
 * The gate a function reaches first: the callee of its first await, followed through local helpers (mentoredFrom,
 * setRetired: plan amendment 10) until it names a function the file doesn't declare.
 */
export function firstGate(declaration: ts.FunctionDeclaration, functions: Map<string, ts.FunctionDeclaration>): string | null {
  const seen = new Set<string>();
  for (let at: ts.FunctionDeclaration | undefined = declaration; at; ) {
    const awaited = firstAwait(at);
    if (!awaited || !ts.isCallExpression(awaited)) return null;
    const name = calleeName(awaited);
    if (!name) return null;
    const local = functions.get(name);
    if (!local || seen.has(name)) return name;
    seen.add(name);
    at = local;
  }
  return null;
}

/** Every .ts and .tsx file under these folders of the repository, as repository paths. */
export function sourceFiles(folders: readonly string[]): string[] {
  const files: string[] = [];
  const walk = (folder: string) => {
    for (const entry of readdirSync(join(ROOT, folder), { withFileTypes: true })) {
      const path = `${folder}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) files.push(path);
    }
  };
  for (const folder of folders) walk(folder);
  return files;
}

/** The names a file imports from other modules, each with the module it came from. */
export function namedImports(file: ts.SourceFile): { name: string; from: string }[] {
  const names: { name: string; from: string }[] = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        names.push({ name: (element.propertyName ?? element.name).text, from: statement.moduleSpecifier.text });
      }
    }
  }
  return names;
}
