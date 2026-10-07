import { defineConfig, type Plugin, type Connect } from "vite";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve(__dirname, "data");
const OWNED_FILE = path.join(DATA_DIR, "owned.json");

async function readOwned(): Promise<number[]> {
  try {
    const parsed = JSON.parse(await readFile(OWNED_FILE, "utf-8"));
    return Array.isArray(parsed.owned) ? parsed.owned : [];
  } catch {
    return [];
  }
}

async function writeOwned(owned: number[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = OWNED_FILE + ".tmp";
  const body = JSON.stringify({ owned: [...new Set(owned)].sort((a, b) => a - b), updated: new Date().toISOString() }, null, 2);
  await writeFile(tmp, body, "utf-8");
  await rename(tmp, OWNED_FILE);
}

/** Tiny file-backed API: GET/PUT /api/owned -> data/owned.json */
function ownedApi(): Plugin {
  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    if (req.url !== "/api/owned") return next();
    try {
      if (req.method === "GET") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ owned: await readOwned() }));
        return;
      }
      if (req.method === "PUT") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const { owned } = JSON.parse(raw);
        if (!Array.isArray(owned) || !owned.every((n) => Number.isInteger(n))) {
          res.statusCode = 400;
          res.end("owned must be an array of integers");
          return;
        }
        await writeOwned(owned);
        res.statusCode = 204;
        res.end();
        return;
      }
      res.statusCode = 405;
      res.end();
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err));
    }
  };
  return {
    name: "owned-api",
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  plugins: [ownedApi()],
  server: { port: 5199 },
  preview: { port: 5199 },
});
