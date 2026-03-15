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
import { handleGetAlbums, handleGetAlbum } from "./routes/albums";
import { handleGetOverrides, handlePutOverrides, handleDeleteOverride } from "./routes/overrides";
import { handleGetSummary } from "./routes/stats";
import { handleGetPlays } from "./routes/plays";
import { handleGetArtists, handleGetArtist } from "./routes/artists";
import { handleGetTracks } from "./routes/tracks";

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

    "/api/albums": {
      GET(req) {
        return handleGetAlbums(db, req);
      },
    },

    "/api/albums/:key": {
      GET(req) {
        return handleGetAlbum(db, req, decodeURIComponent(req.params.key));
      },
    },

    "/api/overrides/:type/:key": {
      GET(req) {
        return handleGetOverrides(db, req.params.type, decodeURIComponent(req.params.key));
      },
      async PUT(req) {
        return handlePutOverrides(db, req, req.params.type, decodeURIComponent(req.params.key));
      },
    },

    "/api/overrides/:type/:key/:field": {
      DELETE(req) {
        return handleDeleteOverride(
          db, req.params.type, decodeURIComponent(req.params.key), req.params.field
        );
      },
    },

    "/api/tracks": {
      GET(req) {
        return handleGetTracks(db, req);
      },
    },

    "/api/artists": {
      GET(req) {
        return handleGetArtists(db, req);
      },
    },

    "/api/artists/:key": {
      GET(req) {
        return handleGetArtist(db, req, decodeURIComponent(req.params.key));
      },
    },

    "/api/plays": {
      GET(req) {
        return handleGetPlays(db, req);
      },
    },

    "/api/stats/summary": {
      GET(req) {
        return handleGetSummary(db, req);
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
