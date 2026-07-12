import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface OpenDatabaseOptions {
  migrationsDirectory: string;
  busyTimeoutMs?: number;
}

export function openDatabase(
  filename: string,
  options: OpenDatabaseOptions,
): DatabaseSync {
  const database = new DatabaseSync(filename);
  try {
    database.exec("PRAGMA journal_mode = WAL");
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(`PRAGMA busy_timeout = ${options.busyTimeoutMs ?? 5_000}`);
    migrate(database, options.migrationsDirectory);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function migrate(database: DatabaseSync, directory: string): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    database
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => Number(row.version)),
  );
  const files = readdirSync(directory)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const version = Number.parseInt(file, 10);
    if (applied.has(version)) continue;
    const sql = readFileSync(join(directory, file), "utf8");
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(sql);
      database
        .prepare(
          "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
        )
        .run(version, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

export function databaseSettings(database: DatabaseSync): {
  journalMode: string;
  foreignKeys: number;
  busyTimeout: number;
} {
  const journalMode = database.prepare("PRAGMA journal_mode").get() as {
    journal_mode: string;
  };
  const foreignKeys = database.prepare("PRAGMA foreign_keys").get() as {
    foreign_keys: number;
  };
  const busyTimeout = database.prepare("PRAGMA busy_timeout").get() as {
    timeout: number;
  };
  return {
    journalMode: journalMode.journal_mode,
    foreignKeys: foreignKeys.foreign_keys,
    busyTimeout: busyTimeout.timeout,
  };
}
