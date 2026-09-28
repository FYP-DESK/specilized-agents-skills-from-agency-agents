# specilized-agents-skills-from-agency-agents

**279 specialist agent prompts** (`.opencode/agents/*.md`) — a remote, public,
token-efficient skill library. Any LLM agent on any machine (Freebuff,
opencode, Claude, anything that can run `curl`) can adopt a specialist role
with **one HTTP call**. The graphify knowledge graph is served at the same URL.

**Deployed at: `https://specilized-agents-skills-from-agenc.vercel.app`**

---

## TL;DR for agents

```bash
# 1. Search — returns best-match agent + instructions JSON
curl -s "https://specilized-agents-skills-from-agenc.vercel.app/api/agent?q=solidity+smart+contract+audit"

# 2. Or fetch a known agent directly as plain markdown
curl -s "https://specilized-agents-skills-from-agenc.vercel.app/api/agent?name=engineering-solidity-smart-contract-engineer&raw=1"
```

System rule to give any LLM agent:

```
When a task needs a specialist role, call:
  curl -s "https://specilized-agents-skills-from-agenc.vercel.app/api/agent?q=<task keywords>"
Read the "instructions" field from the JSON and adopt that role.
If you already know the agent name, call
  https://specilized-agents-skills-from-agenc.vercel.app/api/agent?name=<name>&raw=1
instead.
```

No index reading, no token waste — the server does the search, the agent gets
only the one markdown file it needs.

---

## Endpoints

| Endpoint | What it returns |
|----------|----------------|
| `GET /` | The graphify knowledge graph viewer (`graphify-out/graph.html`, self-contained, search + click to explore) |
| `GET /api/health` | `{ ok, agents, communities, version }` |
| `GET /api/agents` | Full `AGENTS_INDEX.json` (279 agents, 63 categories) |
| `GET /api/categories` | `{ category: [agent names] }` |
| `GET /api/agent?name=X` | Agent JSON: metadata + related agents + full `instructions` |
| `GET /api/agent?name=X&raw=1` | Raw agent markdown (`text/markdown`) |
| `GET /api/agent?q=keywords` | Best match JSON: `instructions` + `score` + `alternates` + `neighbors` |
| `GET /api/agent?q=keywords&raw=1` | Best match markdown only |

Search is weighted keyword scoring: name ×8, category ×3, title ×4,
description ×2, stopwords removed. `neighbors` come from the graphify graph
(`graphify-out/graph.json`), falling back to same-category agents.

---

## Run (local)

```bash
bun install                 # or: npm install
bun run src/server.ts       # or: npx tsx src/server.ts
# agent gateway on http://localhost:3000 (279 agents, 63 categories)
```

Open http://localhost:3000 for the graph, or curl the API.

---

## Registry maintenance

The registry is **generated, never hand-edited**:

```bash
node scripts/generate-agents-index.mjs   # rebuilds AGENTS_INDEX.json
graphify update .                        # rebuilds graphify-out/graph.json + graph.html
```

Re-run both after adding/removing any `.opencode/agents/*.md`, then commit.
Keep `AGENTS_INDEX.json` and `graphify-out/graph.json` committed — the server
reads them directly from the repo; the Vercel build stages them into the
lambda bundle (`scripts/build-serverless-data.mjs`), no sandbox needed.

---

## Deploy (Vercel, free tier)

Already wired: `vercel.json` (build command + CORS headers) and
`api/[[...route]].ts` (serverless entry). The build copies
`graphify-out/graph.html` → `public/index.html` and stages `AGENTS_INDEX.json`
+ agent markdown + the graphify graph next to the function.

```bash
npm i -g vercel && vercel --prod
# first time: link to a new project, framework preset Other, accept the rest
```

The public URL is `https://specilized-agents-skills-from-agenc.vercel.app`
(production domain — redeploying keeps it). The repo also works fully offline:
`AGENTS_INDEX.json` + raw GitHub URLs are the zero-dependency fallback:

```
https://raw.githubusercontent.com/FYP-DESK/specilized-agents-skills-from-agency-agents/main/AGENTS_INDEX.json
https://raw.githubusercontent.com/FYP-DESK/specilized-agents-skills-from-agency-agents/main/.opencode/agents/<name>.md
```

---

## Graphify

The graphify knowledge graph (`graphify-out/`) indexes the agent files. Its
generated `graph.html` — fully self-contained, data embedded — is what gets
served at `/`. The graph edges power the `neighbors` data on every
`/api/agent` answer. Rebuild after registry changes:

```bash
graphify update .
node scripts/build-graph-html.mjs   # refreshes public/index.html (local only; Vercel build does this too)
```

---

## Part of FYP Desk

| Repo | Role |
|------|------|
| `fyp-ideas` | idea board (IDEAS_INDEX.json) |
| **this repo** | specialist skill library + query gateway |
| `fyp-env-setup-development-team` | controlled-env kit for team members |
| `contribution-tracker-valueation` | who did what, valuation + pay split |
