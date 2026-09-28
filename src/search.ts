// Weighted keyword scoring over AGENTS_INDEX.json + graphify neighbor data.
// No external dependencies: split query into tokens, score each agent's
// name (x8), title (x4), description (x2), category (x3) for every token hit.

import { readFileSync } from "node:fs";
import path from "node:path";

export type AgentNode = {
  name: string;
  title: string;
  category: string;
  description: string;
  path: string;
  neighbors: string[];
};

export type AgentGraph = {
  nodes: AgentNode[];
  categories: Record<string, string[]>;
  communities: string[];
};

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "build", "by", "can", "create",
  "do", "for", "from", "how", "i", "in", "into", "is", "it", "me", "my", "need",
  "of", "on", "or", "that", "the", "this", "to", "want", "with", "work",
]);

export function buildGraph(root: string): AgentGraph {
  const idx = JSON.parse(readFileSync(path.join(root, "AGENTS_INDEX.json"), "utf8"));

  // graphify neighbor data (built by `graphify update .`); optional but enriches results.
  // graph.json is node-link format (nodes/links); agent file-level nodes have
  // labels ending in .md. Cross-file links are rare — when missing, neighbors
  // fall back to same-category agents.
  let neighborsByName = new Map<string, string[]>();
  const gp = path.join(root, "graphify-out", "graph.json");
  try {
    const g = JSON.parse(readFileSync(gp, "utf8"));
    const fileId = new Map<string, string>(); // "engineering-foo.md" -> node id
    for (const n of g.nodes ?? []) {
      if (n.file_type === "document" && typeof n.label === "string" && n.label.endsWith(".md")) {
        fileId.set(n.label, n.id);
      }
    }
    const byId = new Map((g.nodes ?? []).map((n) => [n.id, n]));
    const adj = new Map<string, Set<string>>();
    const nameOf = (id: string) => {
      const n = byId.get(id);
      return n ? String(n.label).replace(/\.md$/, "") : "";
    };
    for (const l of g.links ?? []) {
      const a = nameOf(String(l.source));
      const b = nameOf(String(l.target));
      if (a && b && a !== b && fileId.has(`${a}.md`) && fileId.has(`${b}.md`)) {
        if (!adj.has(a)) adj.set(a, new Set());
        if (!adj.has(b)) adj.set(b, new Set());
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
      }
    }
    neighborsByName = new Map([...adj.entries()].map(([k, v]) => [k, [...v].slice(0, 8)]));
  } catch {
    // graph not built yet — neighbors stay empty, search still works
  }

  const nodes: AgentNode[] = (idx.agents ?? []).map((a: Omit<AgentNode, "neighbors">) => ({
    ...a,
    neighbors: neighborsByName.get(a.name) ?? [],
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

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
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
      const word = new RegExp(`\\b${t}\\b`);
      if (word.test(name)) score += 8;
      else if (name.includes(t)) score += 4;
      if (word.test(title)) score += 4;
      if (word.test(desc)) score += 2;
      if (word.test(cat)) score += 3;
    }
    return { ...node, score: score / tokens.length };
  });

  return scored
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, top);
}

export function agentMarkdownPath(root: string, name: string): string {
  // name is already validated as [a-z0-9-] via lookup; still keep it inert
  const safe = name.replace(/[^a-z0-9-]/g, "");
  return path.join(root, ".opencode", "agents", `${safe}.md`);
}
