// The Elysia app, runtime-agnostic: imported by src/server.ts (local listen)
// and api/[[...route]].ts (Vercel serverless). No .listen() here.

import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { Elysia } from "elysia";

import { buildGraph, searchAgents, agentMarkdownPath } from "./search";

// Resolve the repo root in every environment (local Bun, Vercel serverless
// bundle). The marker file AGENTS_INDEX.json is always at the root.
function findRoot(): string {
  const marker = "AGENTS_INDEX.json";
  const here = path.dirname(fileURLToPathSafe());
  const candidates = [
    process.env.AGENTS_ROOT,
    process.cwd(),
    path.resolve(here, ".."),
    here,
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (existsSync(path.join(c, marker))) return c;
  }
  let dir = process.cwd();
  for (let i = 0; i < 8 && dir !== path.parse(dir).root; i++) {
    if (existsSync(path.join(dir, marker))) return dir;
    dir = path.resolve(dir, "..");
  }
  return process.cwd();
}

function fileURLToPathSafe(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("node:url").fileURLToPath(import.meta.url);
  } catch {
    return process.cwd();
  }
}

const root = findRoot();
const graph = buildGraph(root);
const byName = new Map(graph.nodes.map((n) => [n.name, n]));

function errorJson(status: number, message: string, hint?: string) {
  return { error: true, status, message, ...(hint ? { hint } : {}) };
}

const app = new Elysia()
  .get("/", () => {
    const file = path.join(root, "public", "graph.html");
    return new Response(readFileSync(file), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  })

  .get("/api/health", () => ({
    ok: true,
    agents: graph.nodes.length,
    communities: graph.communities.length,
    version: 2,
  }))

  .get("/api/agents", () => {
    const idx = JSON.parse(readFileSync(path.join(root, "AGENTS_INDEX.json"), "utf8"));
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

    const ranked = searchAgents(graph, q, 5);
    if (ranked.length === 0) {
      set.status = 404;
      return errorJson(404, `no agent matches '${query.q}'`, "try shorter or broader keywords, or GET /api/categories");
    }

    const best = ranked[0];
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
      alternates: ranked.slice(1, 4).map((r) => ({ name: r.name, score: Number(r.score.toFixed(4)), description: r.description })),
      instructions,
    };
  });

export { app, root, graph };
