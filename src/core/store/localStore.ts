import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../utils/logger.js';

export interface TableColumn {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
}

export interface TableInfo {
  name: string;
  columns: TableColumn[];
  rowCount: number;
}

export interface LocalStoreStats {
  path: string;
  journalMode: string;
  tablesCount: number;
  tables: Record<string, number>;
}

export class LocalStore {
  private db: DatabaseSync | null = null;
  private dbPath: string;

  constructor(dbPath = 'data/local_store.sqlite') {
    this.dbPath = path.resolve(process.cwd(), dbPath);
    this.init();
  }

  /**
   * Initializes the SQLite database file and configures high-performance WAL mode
   */
  private init(): void {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new DatabaseSync(this.dbPath);

      // Configure WAL (Write-Ahead Logging) mode for zero-lock concurrency
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec('PRAGMA foreign_keys = ON;');

      logger.info({ path: this.dbPath }, '[LocalStore] Embedded SQLite core initialized in WAL mode');
    } catch (error) {
      logger.error({ error, path: this.dbPath }, '[LocalStore] Failed to initialize SQLite database');
      throw error;
    }
  }

  /**
   * Strict Read-Only Guard
   * Ensures that SQL queries executed by AI can only read data and never mutate or corrupt the store.
   */
  validateReadOnly(sql: string): { valid: boolean; reason?: string } {
    const cleanSql = sql.trim();
    if (!cleanSql) {
      return { valid: false, reason: 'Kueri SQL kosong' };
    }

    // Strip comments and string literals to prevent bypass and false positives
    const stripped = cleanSql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .trim();

    // Reject multiple statements separated by semicolons
    const statements = stripped.split(';').map((s) => s.trim()).filter(Boolean);
    if (statements.length > 1) {
      return { valid: false, reason: 'Eksekusi multi-query (;) dilarang demi keamanan' };
    }

    const firstWord = statements[0]?.split(/\s+/)[0]?.toUpperCase();
    if (firstWord !== 'SELECT' && firstWord !== 'WITH' && firstWord !== 'EXPLAIN') {
      return { valid: false, reason: `Hanya kueri SELECT yang diizinkan. Ditemukan: ${firstWord}` };
    }

    // Check for forbidden mutation and system keywords outside quotes
    const forbiddenRegex =
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|REPLACE|CREATE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX)\b/i;
    const forbiddenMatch = stripped.match(forbiddenRegex);
    if (forbiddenMatch) {
      return {
        valid: false,
        reason: `Kata kunci mutasi data dilarang: ${forbiddenMatch[0].toUpperCase()}`,
      };
    }

    return { valid: true };
  }

  /**
   * Executes a safe read-only SQL query with automatic safety guards and capping.
   */
  executeSafeQuery(sql: string, params: any[] = []): any[] {
    if (!this.db) throw new Error('Database is not initialized');

    const validation = this.validateReadOnly(sql);
    if (!validation.valid) {
      throw new Error(`[Security Guard] Query ditolak: ${validation.reason}`);
    }

    let finalSql = sql.trim();
    // Enforce reasonable row limit if query doesn't specify one
    if (!/\bLIMIT\b/i.test(finalSql)) {
      finalSql = `${finalSql} LIMIT 100`;
    }

    const startTime = performance.now();
    const statement = this.db.prepare(finalSql);
    const results = statement.all(...params) as any[];
    const elapsedMs = (performance.now() - startTime).toFixed(2);

    logger.debug(
      { elapsedMs: `${elapsedMs}ms`, rows: results.length, sql: finalSql },
      '[LocalStore] Safe query executed'
    );

    return results;
  }

  /**
   * Dynamic Schema Introspector
   * Generates a concise summary of tables, columns, and data types to inject into AI system prompt.
   */
  getSchemaContext(): string {
    if (!this.db) return '';

    try {
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        .all() as { name: string }[];

      if (tables.length === 0) return '';

      const lines: string[] = ['[DATABASE LOKAL BISNIS (REAL-TIME MIRROR)]:'];
      lines.push(
        'Gunakan tabel di bawah ini untuk menjawab pertanyaan data real-time dengan tool "query_business_data":'
      );

      for (const t of tables) {
        const columns = this.db.prepare(`PRAGMA table_info("${t.name}")`).all() as any[];
        const countRow = this.db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get() as {
          count: number;
        };

        const colDefs = columns.map((c) => `${c.name} (${c.type.toLowerCase()})`).join(', ');
        lines.push(`• Tabel "${t.name}" [${countRow?.count ?? 0} baris]: ${colDefs}`);
      }

      return lines.join('\n');
    } catch (err) {
      logger.warn({ err }, '[LocalStore] Failed to generate schema context');
      return '';
    }
  }

  /**
   * Universal Record Upsert with Auto-DDL Migration
   * Automatically creates or alters table schema based on incoming JSON data keys.
   */
  upsertRecord(table: string, data: Record<string, any>, primaryKey = 'id'): void {
    if (!this.db) throw new Error('Database is not initialized');

    // Clean table name (alphanumeric and underscores only)
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (!safeTable) throw new Error('Nama tabel tidak valid');

    const safePk = primaryKey.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    const keys = Object.keys(data).filter((k) => k.trim());
    if (keys.length === 0) throw new Error('Data payload tidak boleh kosong');

    // 1. Ensure Table Exists with appropriate columns
    this.ensureTableSchema(safeTable, data, safePk);

    // 2. Prepare Parameterized Upsert
    const cols = Object.keys(data);
    const placeholders = cols.map(() => '?').join(', ');
    const updateClauses = cols
      .filter((k) => k !== safePk)
      .map((k) => `"${k}" = excluded."${k}"`)
      .join(', ');

    const values = cols.map((k) => {
      const val = data[k];
      if (val === null || val === undefined) return null;
      if (typeof val === 'object') return JSON.stringify(val);
      if (typeof val === 'boolean') return val ? 1 : 0;
      return val;
    });

    const onConflictClause =
      updateClauses.length > 0
        ? `ON CONFLICT("${safePk}") DO UPDATE SET ${updateClauses}`
        : `ON CONFLICT("${safePk}") DO NOTHING`;

    const sql = `INSERT INTO "${safeTable}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) ${onConflictClause};`;

    this.db.prepare(sql).run(...values);
  }

  /**
   * Deletes a record by primary key
   */
  deleteRecord(table: string, id: any, primaryKey = 'id'): boolean {
    if (!this.db) throw new Error('Database is not initialized');

    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    const safePk = primaryKey.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

    const result = this.db
      .prepare(`DELETE FROM "${safeTable}" WHERE "${safePk}" = ?;`)
      .run(id);

    return (result as any).changes > 0;
  }

  /**
   * Auto-schema migration: Creates table or adds missing columns dynamically
   */
  private ensureTableSchema(table: string, sampleData: Record<string, any>, primaryKey: string): void {
    if (!this.db) return;

    // Check existing columns
    const existingCols = this.db.prepare(`PRAGMA table_info("${table}")`).all() as any[];

    if (existingCols.length === 0) {
      // Create new table
      const colDefs: string[] = [];

      for (const [key, val] of Object.entries(sampleData)) {
        const colType = this.inferSqliteType(val);
        const pkConstraint = key === primaryKey ? ' PRIMARY KEY' : '';
        colDefs.push(`"${key}" ${colType}${pkConstraint}`);
      }

      // If primaryKey was not in data, add it as default
      if (!Object.keys(sampleData).includes(primaryKey)) {
        colDefs.unshift(`"${primaryKey}" INTEGER PRIMARY KEY AUTOINCREMENT`);
      }

      const createSql = `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${colDefs.join(',\n  ')}\n);`;
      this.db.exec(createSql);
      logger.info({ table }, '[LocalStore] Auto-created new local database table');
      return;
    }

    // Table exists: verify if any new columns need to be added (ALTER TABLE)
    const existingNames = new Set(existingCols.map((c) => c.name.toLowerCase()));

    for (const [key, val] of Object.entries(sampleData)) {
      if (!existingNames.has(key.toLowerCase())) {
        const colType = this.inferSqliteType(val);
        try {
          this.db.exec(`ALTER TABLE "${table}" ADD COLUMN "${key}" ${colType};`);
          logger.info({ table, column: key, type: colType }, '[LocalStore] Auto-migrated new column');
        } catch (alterErr) {
          logger.warn({ table, column: key, alterErr }, '[LocalStore] Failed to add column');
        }
      }
    }
  }

  /**
   * Infers SQLite column type from JS runtime value
   */
  private inferSqliteType(val: any): string {
    if (val === null || val === undefined) return 'TEXT';
    if (typeof val === 'number') {
      return Number.isInteger(val) ? 'INTEGER' : 'REAL';
    }
    if (typeof val === 'boolean') return 'INTEGER';
    if (typeof val === 'object') return 'TEXT';
    return 'TEXT';
  }

  /**
   * Returns statistics about stored tables and row counts
   */
  getStats(): LocalStoreStats {
    if (!this.db) {
      return { path: this.dbPath, journalMode: 'OFF', tablesCount: 0, tables: {} };
    }

    try {
      const mode = this.db.prepare('PRAGMA journal_mode;').get() as { journal_mode: string };
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        .all() as { name: string }[];

      const tableStats: Record<string, number> = {};
      for (const t of tables) {
        const countRow = this.db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get() as {
          count: number;
        };
        tableStats[t.name] = countRow?.count ?? 0;
      }

      return {
        path: this.dbPath,
        journalMode: mode?.journal_mode || 'wal',
        tablesCount: tables.length,
        tables: tableStats,
      };
    } catch {
      return { path: this.dbPath, journalMode: 'error', tablesCount: 0, tables: {} };
    }
  }
}

export const localStore = new LocalStore();
