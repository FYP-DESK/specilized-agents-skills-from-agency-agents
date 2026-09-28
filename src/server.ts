// Serverless-ready agent query gateway (ElysiaJS, runtime-agnostic: Bun or Node).
//
// Endpoints:
//   GET  /                     -> graph UI (public/graph.html)
//   GET  /api/health           -> status
//   GET  /api/agents           -> full registry (AGENTS_INDEX.json)
//   GET  /api/categories       -> category -> agent names
//   GET  /api/agent?name=X     -> exact agent markdown (raw text)
//   GET  /api/agent?q=keywords -> best-match agent + neighbors (JSON)
//   GET  /api/agent?q=...&raw=1 -> best-match agent markdown as plain text
//
// Any local LLM agent needs ONE curl to adopt a specialist role:
//   curl -s "http://localhost:3000/api/agent?q=<task keywords>"

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { Elysia } from "elysia";

import { buildGraph, searchAgents, agentMarkdownPath } from "./search";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const graph = buildGraph(root);
const byName = new Map(graph.nodes.map((n) => [n.name, n]));

function errorJson(status: number, message: string, hint?: string) {
  return { error: true, status, message, ...(hint ? { hint } : {}) };
}

const server = new Elysia({ serve: { static: { public: path.join(root, "public") } } })
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
  })

  .listen(Number(process.env.PORT) || 3000);

console.log(`agent gateway on http://localhost:${server.server!.port} (graph: ${graph.nodes.length} agents, ${graph.communities.length} categories)`);

export { server };
