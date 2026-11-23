// Meme Sprint entry (Node 22, standard library only): the meme is entry.png
// beside this file, and the program copies it to /output/entry.png, where the
// gate reads it. Nothing is computed at run time, so the two grader runs
// write identical bytes.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const src = join(here, "entry.png");
const dst = join(outDir, "entry.png");

// Validate the source is a whole PNG before copying (gate: PNG or JPEG,
// at most 1 MiB and 1024x1024 px).
const bytes = readFileSync(src);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) {
  throw new Error("entry.png is not a PNG file");
}
if (bytes.length > 1048576) {
  throw new Error(`entry.png is ${bytes.length} bytes, over the 1 MiB gate`);
}
const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
if (width > 1024 || height > 1024) {
  throw new Error(`entry.png is ${width}x${height}, over the 1024x1024 gate`);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(src, dst);

const sha = createHash("sha256").update(bytes).digest("hex");
console.log(`wrote ${dst} (${width}x${height}, ${bytes.length} bytes, sha256 ${sha})`);
