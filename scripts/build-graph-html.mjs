// Build public/graph.html from public/graph.html.tmpl by injecting AGENTS_INDEX.json
// as __DATA__. Zero dependencies. Run: node scripts/build-graph-html.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tmplPath = path.join(root, "public", "graph.html.tmpl");
const outPath = path.join(root, "public", "graph.html");

const tmpl = fs.readFileSync(tmplPath, "utf8");
const data = fs.readFileSync(path.join(root, "AGENTS_INDEX.json"), "utf8");

// JSON is inserted as a JS object literal — safe because the JSON.stringify
// output never contains "</script" (agent descriptions are plain text).
fs.writeFileSync(outPath, tmpl.replace("__DATA__", data.trim()));

console.log(`public/graph.html built (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB).`);
