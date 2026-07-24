import { Database } from "bun:sqlite";

/// One SQLite file holds everything (users, tokens, bookmarks, settings,
/// geocode cache). WAL for concurrent reads; the API is the only writer.
export function createDb(path: string): Database {
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE,
      pw_hash     TEXT,
      apple_sub   TEXT UNIQUE,
      google_sub  TEXT UNIQUE,
      display_name TEXT,
      created_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT UNIQUE NOT NULL,
      expires_at  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL,
      revoked_at  INTEGER,
      replaced_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);
    CREATE TABLE IF NOT EXISTS bookmarks (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      lat         REAL NOT NULL,
      lon         REAL NOT NULL,
      icon        TEXT NOT NULL DEFAULT 'star',
      note        TEXT NOT NULL DEFAULT '',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bm_user ON bookmarks(user_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS settings (
      user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      active_pack TEXT,
      camera      TEXT,
      updated_at  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS geocode_cache (
      key         TEXT PRIMARY KEY,
      response    TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );
  `);
  return db;
}
