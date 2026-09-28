// The Elysia app, runtime-agnostic: imported by src/server.ts (local listen)
// and api/[[...route]].ts (Vercel serverless). No .listen() here.
//
// Data resolution order:
//   1. AGENTS_ROOT env var (explicit override)
//   2. api/_data bundle (staged by scripts/build-serverless-data.mjs on Vercel)
//   3. repo root (local dev; graphify neighbors included)

import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { Elysia } from "elysia";

import { buildGraph, searchAgents, agentMarkdownPath } from "./search";

const MARKER = "AGENTS_INDEX.json";

function findRoot(): string {
  if (process.env.AGENTS_ROOT && existsSync(path.join(process.env.AGENTS_ROOT, MARKER))) {
    return process.env.AGENTS_ROOT;
  }
  // Vercel function bundle: cwd is /var/task/player/<...>/ (deploy output),
  // the staged bundle sits at api/_data relative to the repo layout.
  const cwd = process.cwd();
  const staged = path.resolve(cwd, "api/_data");
  if (existsSync(path.join(staged, MARKER))) return staged;
  // Local dev: repo root is one or two levels up from src/.
  for (const candidate of [cwd, path.resolve(cwd, "..")]) {
    if (existsSync(path.join(candidate, MARKER))) return candidate;
  }
  // Last resort: walk up.
  let dir = cwd;
  for (let i = 0; i < 8 && dir !== path.parse(dir).root; i++) {
    if (existsSync(path.join(dir, MARKER))) return dir;
    dir = path.resolve(dir, "..");
  }
  return cwd;
}

const root = findRoot();
const graph = buildGraph(root);
const byName = new Map(graph.nodes.map((n) => [n.name, n]));

function errorJson(status: number, message: string, hint?: string) {
  return { error: true, status, message, ...(hint ? { hint } : {}) };
}

const app = new Elysia()
  .get("/", () => {
    // On Vercel the static public/index.html wins before this route; locally
    // this serves the built UI (run `bun run ui` once after cloning).
    const file = path.join(root, "public", "index.html");
    if (!existsSync(file)) {
      const staticFile = path.join(root, "..", "public", "index.html");
      if (existsSync(staticFile)) {
        return new Response(readFileSync(staticFile), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      return new Response(
        "<p>UI not built yet. Run <code>node scripts/build-graph-html.mjs</code> in the repo, then restart.</p>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    return new Response(readFileSync(file), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  })

  .get("/api/health", () => ({
    ok: true,
    agents: graph.nodes.length,
    communities: graph.communities.length,
    version: 3,
  }))

  .get("/api/agents", () => {
    const idx = JSON.parse(readFileSync(path.join(root, MARKER), "utf8"));
    return idx;
  })

  .get("/api/categories", () => graph.categories)

  .get("/api/agent", ({ query, set }) => {
    const raw = query.raw === "1" || query.raw === "true";

    // 1) Exact fetch by name (deterministic, zero ambiguity)
    if (query.name) {
      const name = query.name.toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!name || !byName.has(name)) {
        set.status = 404;
        return errorJson(404, `agent '${query.name}' not found`, "GET /api/agents for the full list");
      }
      if (raw) {
        return new Response(readFileSync(agentMarkdownPath(root, name)), {
          headers: { "content-type": "text/markdown; charset=utf-8" },
        });
      }
      const node = byName.get(name)!;
      return {
        name,
        title: node.title,
        category: node.category,
        description: node.description,
        neighbors: node.neighbors,
        instructions: readFileSync(agentMarkdownPath(root, name), "utf8"),
      };
    }

    // 2) Query search: score, take top1, attach related agents from the graph
    const q = (query.q ?? "").toLowerCase().trim();
    if (!q) {
      set.status = 400;
      return errorJson(400, "missing query", "pass ?name=<agent> or ?q=<task keywords>");
    }

    const [best] = searchAgents(graph, q, 5);
    if (!best) {
      set.status = 404;
      return errorJson(404, `no agent matches '${query.q}'`, "try shorter or broader keywords, or GET /api/categories");
    }

    const instructions = readFileSync(agentMarkdownPath(root, best.name), "utf8");

    if (raw) {
      return new Response(instructions, {
        headers: { "content-type": "text/markdown; charset=utf-8" },
      });
    }

    set.headers["x-agent-score"] = String(best.score);
    return {
      name: best.name,
      title: best.title,
      category: best.category,
      description: best.description,
      score: Number(best.score.toFixed(4)),
      neighbors: byName.get(best.name)?.neighbors ?? [],
      alternates: searchAgents(graph, q, 4).slice(1).map((r) => ({ name: r.name, score: Number(r.score.toFixed(4)), description: r.description })),
      instructions,
    };
  });

export { app, root, graph };
