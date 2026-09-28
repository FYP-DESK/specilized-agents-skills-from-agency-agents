// Vercel serverless entry — mounts the Elysia app at every route.
// Local dev keeps using `bun run src/server.ts`; Vercel uses this file.
//
// NOTE: the relative import MUST keep the explicit .js extension. Vercel
// compiles this TS to ESM JS and runs it on the Node runtime, which does not
// resolve extensionless imports — that was the FUNCTION_INVOCATION_FAILED
// cause ("Cannot find module '/var/task/src/app'"). Bun resolves .js -> .ts,
// so local dev under bun is unaffected.
//
// app.handle is invoked through an arrow wrapper so it stays bound to the
// app instance. The data it reads (AGENTS_INDEX.json, agents/*.md,
// graphify-out/graph.json) is staged into api/_data by
// scripts/build-serverless-data.mjs during the build command.

import { app } from "../src/app.js";

export default async function handler(request: Request) {
  return app.handle(request);
}

export const GET = handler;
export const POST = handler;
export const HEAD = handler;
