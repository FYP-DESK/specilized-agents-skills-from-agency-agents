// Weighted keyword scoring over AGENTS_INDEX.json + graphify neighbor data.
// No external dependencies: split query into tokens, score each agent's
// name (x8), title (x4), description (x2), category (x3) for every token hit.
//
// Hardened scorer (v4):
// - short technical tokens (ai, ml, ui, ux, qa, db, 3d, …) are WHITELISTED
//   instead of silently dropped — they used to make ?q=ai return nothing
// - stopword filtering keeps the natural-language verbs out, but tokenize()
//   now also reports WHAT it dropped so the API can teach the caller how to
//   fix a bad query (see diagnoseQuery)

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type AgentNode = {
  name: string;
  title: string;
  category: string;
  description: string;
  path: string;
  neighbors: string[];
};

type GraphifyNode = {
  id?: unknown;
  label?: unknown;
  file_type?: unknown;
  tags?: unknown;
  summary?: unknown;
};

type GraphifyLink = {
  source?: unknown;
  target?: unknown;
};

type GraphifyGraph = {
  nodes?: GraphifyNode[];
  links?: GraphifyLink[];
  communities?: unknown;
};

type RawIndexEntry = {
  name?: unknown;
  title?: unknown;
  category?: unknown;
  description?: unknown;
  path?: unknown;
};

export type AgentGraph = {
  nodes: AgentNode[];
  categories: Record<string, string[]>;
  communities: string[];
};

export const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "build", "by", "can", "create",
  "do", "for", "from", "how", "i", "in", "into", "is", "it", "me", "my", "need",
  "of", "on", "or", "that", "the", "this", "to", "want", "with", "work",
]);

// Technical tokens that MUST survive despite being ≤2 characters. Anything
// matching an agent name/title matters more than its length.
const SHORT_ALLOWED = new Set([
  "ai", "ml", "ui", "ux", "qa", "db", "os", "pm", "3d", "go", "js", "ts",
  "vr", "ar", "ci", "cd", "crm", "erp", "api", "sdk", "seo", "llm", "gpt",
  "nlp", "css", "php", "c", "r", "k8s",
]);

export type QueryDiagnostics = {
  tokens: string[];        // what actually got scored
  droppedStopwords: string[]; // natural-language words that score nothing
  droppedTooShort: string[];  // ≤2-char tokens not on the allowlist
  suggestedQuery: string | null; // a tightened query, when the original was weak
};

export function diagnoseQuery(query: string): QueryDiagnostics {
  const tokens: string[] = [];
  const droppedStopwords: string[] = [];
  const droppedTooShort: string[] = [];
  for (const t of query.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!t) continue;
    if (STOPWORDS.has(t)) droppedStopwords.push(t);
    else if (t.length <= 2 && !SHORT_ALLOWED.has(t)) droppedTooShort.push(t);
    else tokens.push(t);
  }
  return { tokens, droppedStopwords, droppedTooShort, suggestedQuery: null };
}

export function buildGraph(root: string): AgentGraph {
  const idx = JSON.parse(readFileSync(path.join(root, "AGENTS_INDEX.json"), "utf8"));

  // graphify neighbor data (built by `graphify update .`); optional but enriches results.
  // graph.json is node-link format (nodes/links); agent file-level nodes have
  // labels ending in .md. Cross-file links are rare — when missing, neighbors
  // fall back to same-category agents. Lookup order: the staged serverless
  // bundle (api/_data/graphify-graph.json, copied by
  // scripts/build-serverless-data.mjs) first, then the repo layout
  // (graphify-out/graph.json). If neither exists, this silently skips.
  let neighborsByName = new Map<string, string[]>();
  const graphPaths = [
    path.join(root, "graphify-graph.json"), // staged serverless bundle
    path.join(root, "graphify-out", "graph.json"), // repo layout
  ];
  const gp = graphPaths.find((p) => existsSync(p));
  if (gp) {
    try {
    const g = JSON.parse(readFileSync(gp, "utf8")) as GraphifyGraph;
    const fileId = new Map<string, string>(); // "engineering-foo.md" -> node id
    for (const n of g.nodes ?? []) {
      if (
        n.file_type === "document" &&
        typeof n.label === "string" &&
        typeof n.id === "string" &&
        n.label.endsWith(".md")
      ) {
        fileId.set(n.label, n.id);
      }
    }
    const byId = new Map<string, GraphifyNode>();
    for (const n of g.nodes ?? []) {
      if (typeof n.id === "string") byId.set(n.id, n);
    }
    const adj = new Map<string, Set<string>>();
    const nameOf = (id: string): string => {
      const n = byId.get(id);
      return n && typeof n.label === "string" ? n.label.replace(/\.md$/, "") : "";
    };
    for (const l of g.links ?? []) {
      if (typeof l.source !== "string" || typeof l.target !== "string") continue;
      const a = nameOf(l.source);
      const b = nameOf(l.target);
      if (a && b && a !== b && fileId.has(`${a}.md`) && fileId.has(`${b}.md`)) {
        if (!adj.has(a)) adj.set(a, new Set());
        if (!adj.has(b)) adj.set(b, new Set());
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
      }
    }
    neighborsByName = new Map([...adj.entries()].map(([k, v]) => [k, [...v].slice(0, 8)]));
    } catch {
      // graph unreadable — neighbors stay empty, search still works
    }
  }

  const nodes: AgentNode[] = (idx.agents ?? []).map((raw: RawIndexEntry) => ({
    name: String(raw.name ?? ""),
    title: String(raw.title ?? raw.name ?? ""),
    category: String(raw.category ?? "general"),
    description: String(raw.description ?? ""),
    path: String(raw.path ?? ""),
    neighbors: neighborsByName.get(String(raw.name ?? "")) ?? [],
  }));

  const categories: Record<string, string[]> = {};
  for (const n of nodes) (categories[n.category] ||= []).push(n.name);

  // category fallback for neighbors (applied lazily so the graph stays pure data)
  for (const n of nodes) {
    if (n.neighbors.length === 0) {
      n.neighbors = (categories[n.category] ?? []).filter((x) => x !== n.name).slice(0, 8);
    }
  }

  return { nodes, categories, communities: Object.keys(categories) };
}

export function tokenize(q: string): string[] {
  return diagnoseQuery(q).tokens;
}

export function searchAgents(
  graph: AgentGraph,
  query: string,
  top = 5,
): Array<AgentNode & { score: number }> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored = graph.nodes.map((node) => {
    const name = node.name.toLowerCase();
    const title = node.title.toLowerCase();
    const desc = node.description.toLowerCase();
    const cat = node.category.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      const word = new RegExp(`\\b${escapeRe(t)}\\b`);
      if (word.test(name)) score += 8;
      else if (name.includes(t)) score += 4;
      if (word.test(title)) score += 4;
      if (word.test(cat)) score += 3;
      if (word.test(desc)) score += 2;
      else if (desc.includes(t) && t.length >= 4) score += 1; // stem-ish fallback
    }
    return { ...node, score: score / tokens.length };
  });

  return scored
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function agentMarkdownPath(root: string, name: string): string {
  // name is already validated as [a-z0-9-] via lookup; still keep it inert
  const safe = name.replace(/[^a-z0-9-]/g, "");
  // staged serverless bundle (api/_data/agents) or repo layout (.opencode/agents)
  const staged = path.join(root, "agents");
  if (existsSync(staged)) return path.join(staged, `${safe}.md`);
  return path.join(root, ".opencode", "agents", `${safe}.md`);
}
