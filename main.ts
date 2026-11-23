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
// at most 1 MiB and 1024x1024 px). Besides the magic, size and dimensions,
// check the chunk structure so a truncated or corrupt file is rejected
// instead of shipped: the first chunk must be IHDR and the file must end
// with a whole IEND chunk.
const bytes = readFileSync(src);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) {
  throw new Error("entry.png is not a PNG file");
}
// A whole PNG is at least 45 bytes: 8-byte signature + 25-byte IHDR chunk
// (4 length + 4 type + 13 data + 4 CRC) + 12-byte IEND chunk
// (4 length + 4 type + 4 CRC). Anything shorter is truncated.
if (bytes.length < 45) {
  throw new Error(`entry.png is only ${bytes.length} bytes, shorter than the 45-byte minimum for a whole PNG`);
}
if (bytes.length > 1048576) {
  throw new Error(`entry.png is ${bytes.length} bytes, over the 1 MiB gate`);
}
// First chunk must be IHDR: 4-byte length 13 at offset 8, type "IHDR" at 12.
if (bytes.readUInt32BE(8) !== 13 || !bytes.subarray(12, 16).equals(Buffer.from("IHDR"))) {
  throw new Error("entry.png does not start with an IHDR chunk");
}
const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
if (width > 1024 || height > 1024) {
  throw new Error(`entry.png is ${width}x${height}, over the 1024x1024 gate`);
}
// Last chunk must be IEND: 4-byte length 0, type "IEND", CRC 0xAE426082.
const tail = bytes.subarray(bytes.length - 12);
if (tail.readUInt32BE(0) !== 0 || !tail.subarray(4, 8).equals(Buffer.from("IEND")) || tail.readUInt32BE(8) !== 0xae426082) {
  throw new Error("entry.png does not end with a whole IEND chunk (truncated file?)");
}

// Walk every chunk from offset 8: each chunk is 4-byte length + 4-byte
// type + length bytes of data + 4-byte CRC. Require the first chunk to be
// IHDR, at least one IDAT chunk before IEND (a PNG with IHDR and IEND but
// no image data is not a picture), and IEND as the last chunk. This also
// rejects trailing garbage and a chunk length that runs past the file end.
let offset = 8;
let first = true;
let seenIdat = false;
let sawIend = false;
while (offset + 8 <= bytes.length) {
  const chunkLen = bytes.readUInt32BE(offset);
  const chunkType = bytes.subarray(offset + 4, offset + 8).toString("ascii");
  if (offset + 12 + chunkLen > bytes.length) {
    throw new Error(`entry.png chunk ${chunkType} at offset ${offset} runs past the end of the file`);
  }
  if (first && chunkType !== "IHDR") {
    throw new Error("entry.png does not start with an IHDR chunk");
  }
  first = false;
  if (chunkType === "IDAT") seenIdat = true;
  if (chunkType === "IEND") {
    if (chunkLen !== 0 || offset + 12 !== bytes.length) {
      throw new Error("entry.png IEND chunk is not the last chunk");
    }
    sawIend = true;
    break;
  }
  offset += 12 + chunkLen;
}
if (!sawIend) {
  throw new Error("entry.png does not end with a whole IEND chunk (truncated file?)");
}
if (!seenIdat) {
  throw new Error("entry.png has no IDAT chunk (no image data)");
}

mkdirSync(outDir, { recursive: true });
copyFileSync(src, dst);

const sha = createHash("sha256").update(bytes).digest("hex");
console.log(`wrote ${dst} (${width}x${height}, ${bytes.length} bytes, sha256 ${sha})`);
