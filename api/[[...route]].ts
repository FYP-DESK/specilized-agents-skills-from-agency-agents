// Vercel serverless entry — mounts the Elysia app at every route.
// Local dev keeps using `bun run src/server.ts`; Vercel uses this file.

import { Elysia } from "elysia";
import { app } from "../src/app";

export const GET = app.handle;
export const POST = app.handle;
export const HEAD = app.handle;

// Vercel's Node runtime import shape (fallback for non-edge deployments)
export default async function handler(request: Request) {
  return app.handle(request);
}

// keep Elysia referenced for type inference on the handle export
void Elysia;
