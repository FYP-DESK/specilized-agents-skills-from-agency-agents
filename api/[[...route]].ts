// Vercel serverless entry — mounts the Elysia app at every route.
// Local dev keeps using `bun run src/server.ts`; Vercel uses this file.
//
// app.handle is invoked through an arrow wrapper so it stays bound to the
// app instance. The data files it reads (AGENTS_INDEX.json, .opencode/agents/**,
// public/index.html, graphify-out/graph.json) are added to the lambda bundle
// via vercel.json functions.includeFiles — their paths are computed at
// runtime, invisible to Vercel's static file tracer.

import { app } from "../src/app";

export default async function handler(request: Request) {
  return app.handle(request);
}

export const GET = handler;
export const POST = handler;
export const HEAD = handler;
