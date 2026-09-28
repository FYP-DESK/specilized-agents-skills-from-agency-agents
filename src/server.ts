// Local dev server — same app as the Vercel deployment (src/app.ts).
// Run: bun run src/server.ts   (or: npx tsx src/server.ts)

import { app } from "./app.js";

const port = Number(process.env.PORT) || 3000;
app.listen(port);

console.log(`agent gateway on http://localhost:${port}`);
