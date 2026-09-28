// Vercel serverless entry — mounts the Elysia app at every route.
// Local dev keeps using `bun run src/server.ts`; Vercel uses this file.
//
// NOTE: the relative import MUST keep the explicit .js extension. Vercel
// compiles this TS to ESM JS and runs it on the Node runtime, which does not
// resolve extensionless imports — that was the FUNCTION_INVOCATION_FAILED
// cause ("Cannot find module '/var/task/src/app'"). Bun resolves .js -> .ts,
// so local dev under bun is unaffected.
//
// NOTE: only NAMED HTTP-method exports are used here (GET, POST, ...). The
// default export has the Node signature `(req, res) => void`, which ignores
// returned Responses — Vercel warns about it and any fallthrough request
// (e.g. OPTIONS) would get an empty reply. app.handle() works with every
// method, so each named export just forwards to it.
//
// The data it reads (AGENTS_INDEX.json, agents/*.md, graphify graph) is
// staged into api/_data by scripts/build-serverless-data.mjs during the
// build command.

import { app } from "../src/app.js";

const handler = (request: Request) => app.handle(request);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
