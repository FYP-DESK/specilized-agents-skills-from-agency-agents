# specilized-agents-skills-from-agency-agents

**279 specialist agent prompts** (`.opencode/agents/*.md`) — a remote, public,
token-efficient skill library. Any LLM agent on any machine can adopt a
specialist role with **one HTTP call**. Browse them in a browser at the same URL.

---

## TL;DR for agents

```bash
# 1. Search (returns best-match agent + instructions JSON, ~1-2 KB meta only if you ask)
curl -s "https://<deployment>/api/agent?q=solidity+smart+contract+audit"

# 2. Or fetch a known agent directly as plain markdown
curl -s "https://<deployment>/api/agent?name=engineering-solidity-smart-contract-engineer&raw=1"
```

System rule to give any LLM agent:

```
When a task needs a specialist role, call:
  curl -s "<deployment>/api/agent?q=<task keywords>"
Read the "instructions" field from the JSON and adopt that role.
If you already know the agent name, call /api/agent?name=<name>&raw=1 instead.
```

No index reading, no token waste — the server does the search, the agent gets
only the one markdown file it needs.

---

## Endpoints

| Endpoint | What it returns |
|----------|----------------|
| `GET /` | Browser UI — search + browse all agents, click for full markdown |
| `GET /api/health` | `{ ok, agents, communities, version }` |
| `GET /api/agents` | Full `AGENTS_INDEX.json` (279 agents, 63 categories) |
| `GET /api/categories` | `{ category: [agent names] }` |
| `GET /api/agent?name=X` | Agent JSON: metadata + related agents + full `instructions` |
| `GET /api/agent?name=X&raw=1` | Raw agent markdown (`text/markdown`) |
| `GET /api/agent?q=keywords` | Best match JSON: `instructions` + `score` + `alternates` + `neighbors` |
| `GET /api/agent?q=keywords&raw=1` | Best match markdown only |

Search is weighted keyword scoring: name ×8, category ×3, title ×4,
description ×2, stopwords removed. `neighbors` come from the graphify graph
(`graphify-out/graph.json`), so related agents ride along with every answer.

---

## Run

```bash
bun install                 # or: npm install
bun run src/server.ts       # or: npx tsx src/server.ts
# agent gateway on http://localhost:3000 (graph: 279 agents, 63 categories)
```

Open http://localhost:3000 for the UI, or curl the API.

---

## Registry maintenance

The registry is **generated, never hand-edited**:

```bash
node scripts/generate-agents-index.mjs   # rebuilds AGENTS_INDEX.json
```

Re-run after adding/removing any `.opencode/agents/*.md`, then commit both.
Keep `AGENTS_INDEX.json` committed — the server (and any raw-curl fallback
agent) reads it directly from the repo, no build step required.

---

## Deploy (Vercel, free tier)

```bash
npm i -g vercel && vercel      # framework preset: Other, no build command needed
```

Vercel serves this as a static+serverless app. After deploy, the public URL is
the `<deployment>` in the snippets above. The repo also works fully offline:
`AGENTS_INDEX.json` + raw GitHub URLs are the zero-dependency fallback:

```
https://raw.githubusercontent.com/FYP-DESK/specilized-agents-skills-from-agency-agents/main/AGENTS_INDEX.json
https://raw.githubusercontent.com/FYP-DESK/specilized-agents-skills-from-agency-agents/main/.opencode/agents/<name>.md
```

---

## Graphify

The graphify knowledge graph (`graphify-out/`, gitignored artifacts excluded)
indexes the agent files; its neighbor edges power the "related agents" data.
Rebuild after registry changes:

```bash
graphify update .
```

---

## Part of FYP Desk

| Repo | Role |
|------|------|
| `fyp-ideas` | idea board (IDEAS_INDEX.json) |
| **this repo** | specialist skill library + query gateway |
| `fyp-env-setup-development-team` | controlled-env kit for team members |
| `contribution-tracker-valueation` | who did what, valuation + pay split |
