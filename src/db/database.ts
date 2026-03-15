import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { join } from "path";
import { runMigrations } from "./migrations";

function getDataDir(): string {
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? join(process.env.USERPROFILE ?? ".", "AppData", "Roaming"), "spotify-data-cruncher");
  }
  return join(process.env.HOME ?? "~", ".local", "share", "spotify-data-cruncher");
}

export function openDatabase(path?: string): Database {
  const dbPath = path ?? join(getDataDir(), "data.db");

  if (!path) {
    mkdirSync(getDataDir(), { recursive: true });
  }

  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");
  runMigrations(db);
  return db;
}
