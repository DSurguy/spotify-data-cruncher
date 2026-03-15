import { serve } from "bun";
import index from "./index.html";
import { openDatabase } from "./db/database";
import {
  handleGetDatasets,
  handleGetDataset,
  handlePatchDataset,
  handleDeleteDataset,
} from "./routes/datasets";
import { handleImport } from "./routes/import-handler";

function parseDataDir(): string | undefined {
  const i = process.argv.indexOf("--data-dir");
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const dataDir = parseDataDir();
const db = openDatabase(dataDir);

const server = serve({
  routes: {
    "/*": index,

    "/api/datasets": {
      GET() {
        return handleGetDatasets(db);
      },
      async POST(req) {
        return handleImport(db, req);
      },
    },

    "/api/datasets/:id": {
      async GET(req) {
        return handleGetDataset(db, Number(req.params.id));
      },
      async PATCH(req) {
        const body = await req.json();
        return handlePatchDataset(db, Number(req.params.id), body);
      },
      DELETE(req) {
        return handleDeleteDataset(db, Number(req.params.id));
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
console.log(`💾 Database: ${dataDir ?? "(default user data dir)"}`);
