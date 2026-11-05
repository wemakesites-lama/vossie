/**
 * Writes CampusCart's app icons, favicon and the mark's master SVGs from lib/brand (logo spec 3.3 and 4).
 * Run from the project root whenever the mark changes:  pnpm icons
 *
 * sharp isn't a project dependency: it comes with Next, so it's found through next's own package.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { markSvg, NAVY, SKY, WHITE } from "../lib/brand/cart-mark.ts";
import { icoFrom } from "../lib/brand/ico.ts";
import { FAVICON, ICON_FILES, iconSvg } from "../lib/brand/icons.ts";

type Sharp = (input: Buffer) => { png: (options: { compressionLevel: number }) => { toBuffer: () => Promise<Buffer> } };

const root = join(import.meta.dirname, "..");
const fromNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
let sharp: Sharp;
try {
  sharp = fromNext("sharp") as Sharp;
} catch {
  throw new Error("sharp wasn't found through Next. Install the version Next uses: pnpm add -D sharp@<Next's sharp version>");
}

const png = (svg: string) => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

function write(file: string, data: string | Uint8Array) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`wrote ${file}`);
}

// Navy for white surfaces (all stars navy); white with the sky star for navy ones (logo spec 2.3).
const masters = [
  ["campuscart-mark-navy.svg", "full", NAVY, NAVY],
  ["campuscart-mark-white.svg", "full", WHITE, SKY],
  ["campuscart-mark-small-navy.svg", "small", NAVY, NAVY],
  ["campuscart-mark-small-white.svg", "small", WHITE, SKY],
] as const;
for (const [name, cut, lines, star] of masters) write(`assets/brand/${name}`, markSvg(cut, lines, star));

for (const icon of ICON_FILES) write(icon.file, await png(iconSvg(icon)));

const favicon = await Promise.all(
  FAVICON.images.map(async (image) => ({ size: image.size, png: await png(iconSvg({ ...image, corner: FAVICON.corner })) })),
);
write(FAVICON.file, icoFrom(favicon));
