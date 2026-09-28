// Build the public graph viewer:
//   public/index.html  <-  graphify-out/graph.html (copied verbatim)
//
// graph.html is self-contained (graph data embedded inline; only vis-network
// comes from a CDN), so graphify's own output is served as-is at '/' — no
// custom UI needed.
//
// Zero dependencies. Run: node scripts/build-graph-html.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, "graphify-out", "graph.html");
const outDir = path.join(root, "public");
const outPath = path.join(outDir, "index.html");

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(src, outPath);

console.log(`public/index.html built from graphify-out/graph.html (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB).`);
