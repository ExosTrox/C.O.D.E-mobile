import { Database } from "bun:sqlite";
import { resolve, join } from "path";
import { readdirSync, readFileSync } from "fs";

export class AppDatabase {
  readonly db: Database;
  private readonly migrationsDir: string;

  constructor(dataDir: string) {
    const dbPath = resolve(dataDir, "codemobile.db");
    this.db = new Database(dbPath, { create: true, strict: true });

    // Enable WAL mode for concurrent reads
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    this.db.run("PRAGMA busy_timeout = 5000");

    // Migrations are bundled relative to this source file
    this.migrationsDir = join(import.meta.dir, "migrations");

    this.ensureMigrationsTable();
  }

  private ensureMigrationsTable(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
  }

  runMigrations(): void {
    const files = readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const applied = new Set(
      this.db
        .query<{ name: string }, []>("SELECT name FROM _migrations")
        .all()
        .map((r) => r.name),
    );

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = readFileSync(join(this.migrationsDir, file), "utf-8");
      console.log(`  Running migration: ${file}`);

      this.db.transaction(() => {
        this.db.run(sql);
        this.db.run("INSERT INTO _migrations (name) VALUES (?)", [file]);
      })();
    }
  }

  getSessionCount(): number {
    const row = this.db
      .query<{ count: number }, []>(
        "SELECT COUNT(*) as count FROM sessions WHERE status IN ('starting', 'running')",
      )
      .get();
    return row?.count ?? 0;
  }

  /** Delete all user data. Keeps schema intact. */
  resetAllData(): void {
    const tables = this.db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_migrations' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((r) => r.name);

    // PRAGMA foreign_keys must be set outside transactions in SQLite
    this.db.run("PRAGMA foreign_keys = OFF");
    this.db.transaction(() => {
      for (const table of tables) {
        this.db.run(`DELETE FROM "${table}"`);
      }
    })();
    this.db.run("PRAGMA foreign_keys = ON");

    console.log(`  [DB] Reset complete — cleared ${tables.length} tables`);
  }

  close(): void {
    this.db.close();
  }
}
