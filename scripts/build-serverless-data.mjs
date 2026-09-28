// Stage runtime data next to the serverless function (api/_data/).
// Colocated files in api/ are included in the function bundle automatically —
// no includeFiles globs needed. The .opencode dot-directory and repo-root
// files are invisible to Vercel's tracer, hence this staging step.
//
// graphify-out/graph.json IS staged now: the committed graph is ~6 MB and
// gzips to well under 1 MB over the wire, so the cold-start cost is small and
// every /api/agent response gets real graphify neighbors in production.
//
// Run: node scripts/build-serverless-data.mjs   (part of the build command)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "api", "_data");
const agentsOut = path.join(outDir, "agents");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(agentsOut, { recursive: true });

fs.copyFileSync(
  path.join(root, "AGENTS_INDEX.json"),
  path.join(outDir, "AGENTS_INDEX.json"),
);

const graphJson = path.join(root, "graphify-out", "graph.json");
if (fs.existsSync(graphJson)) {
  fs.copyFileSync(graphJson, path.join(outDir, "graphify-graph.json"));
}

const src = path.join(root, ".opencode", "agents");
let count = 0;
for (const f of fs.readdirSync(src)) {
  if (!f.endsWith(".md")) continue;
  fs.copyFileSync(path.join(src, f), path.join(agentsOut, f));
  count++;
}

console.log(
  `api/_data staged: AGENTS_INDEX.json + ${fs.existsSync(path.join(outDir, "graphify-graph.json")) ? "graphify graph + " : ""}${count} agent files.`,
);
