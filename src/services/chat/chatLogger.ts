import { randomUUID } from 'node:crypto';
import { localStore } from '../../core/store/localStore.js';
import { logger } from '../../utils/logger.js';

export interface ChatLogEntry {
  id: string;
  sessionId: string;
  senderNumber: string;
  senderName: string;
  userMessage: string;
  aiResponse: string | null;
  status: 'replied' | 'error' | 'muted' | 'command';
  latencyMs: number | null;
  source: 'ai' | 'command' | 'system' | 'intent';
  createdAt: string;
}

export interface ChatStats {
  totalCount: number;
  todayCount: number;
  avgLatencyMs: number;
}

export class ChatLogger {
  private buffer: ChatLogEntry[] = [];
  private readonly maxBufferSize = 100;
  private tableReady = false;

  constructor() {
    this.ensureTable();
  }

  /**
   * Initializes the persistent _chat_logs table in SQLite
   */
  private ensureTable(): void {
    try {
      const db = localStore.getDatabase();
      if (!db) return;

      db.exec(`
        CREATE TABLE IF NOT EXISTS _chat_logs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          sender_number TEXT NOT NULL,
          sender_name TEXT,
          user_message TEXT NOT NULL,
          ai_response TEXT,
          status TEXT NOT NULL,
          latency_ms INTEGER,
          source TEXT DEFAULT 'ai',
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON _chat_logs(created_at DESC);
      `);

      this.tableReady = true;

      // Hydrate in-memory buffer with recent entries
      const rows = db
        .prepare(`SELECT * FROM _chat_logs ORDER BY created_at DESC LIMIT ?`)
        .all(this.maxBufferSize) as any[];

      this.buffer = rows.map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        senderNumber: r.sender_number,
        senderName: r.sender_name || r.sender_number,
        userMessage: r.user_message,
        aiResponse: r.ai_response,
        status: r.status,
        latencyMs: r.latency_ms,
        source: r.source || 'ai',
        createdAt: r.created_at,
      }));
    } catch (err) {
      logger.warn({ err }, '[ChatLogger] Failed to initialize _chat_logs SQLite table');
    }
  }

  /**
   * Records a chat interaction to in-memory buffer and SQLite
   */
  log(params: {
    sessionId: string;
    senderNumber: string;
    senderName?: string;
    userMessage: string;
    aiResponse?: string | null;
    status?: 'replied' | 'error' | 'muted' | 'command';
    latencyMs?: number | null;
    source?: 'ai' | 'command' | 'system' | 'intent';
  }): ChatLogEntry {
    const entry: ChatLogEntry = {
      id: randomUUID(),
      sessionId: params.sessionId,
      senderNumber: params.senderNumber,
      senderName: params.senderName || params.senderNumber,
      userMessage: params.userMessage,
      aiResponse: params.aiResponse ?? null,
      status: params.status || 'replied',
      latencyMs:
        params.latencyMs !== undefined && params.latencyMs !== null
          ? Math.round(params.latencyMs)
          : null,
      source: params.source || 'ai',
      createdAt: new Date().toISOString(),
    };

    // Add to in-memory ring buffer (newest first)
    this.buffer.unshift(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.pop();
    }

    // Persist to SQLite
    try {
      const db = localStore.getDatabase();
      if (db) {
        if (!this.tableReady) this.ensureTable();

        db.prepare(
          `INSERT INTO _chat_logs (id, session_id, sender_number, sender_name, user_message, ai_response, status, latency_ms, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          entry.id,
          entry.sessionId,
          entry.senderNumber,
          entry.senderName,
          entry.userMessage,
          entry.aiResponse,
          entry.status,
          entry.latencyMs,
          entry.source,
          entry.createdAt
        );
      }
    } catch (err) {
      logger.error({ err, id: entry.id }, '[ChatLogger] Failed to persist chat log to SQLite');
    }

    return entry;
  }

  /**
   * Retrieves recent chat entries
   */
  getRecent(limit = 30): ChatLogEntry[] {
    const cap = Math.min(Math.max(limit, 1), 100);
    if (this.buffer.length >= cap) {
      return this.buffer.slice(0, cap);
    }

    // Fallback to SQLite if buffer has fewer than requested
    try {
      const db = localStore.getDatabase();
      if (db) {
        const rows = db
          .prepare(`SELECT * FROM _chat_logs ORDER BY created_at DESC LIMIT ?`)
          .all(cap) as any[];

        return rows.map((r) => ({
          id: r.id,
          sessionId: r.session_id,
          senderNumber: r.sender_number,
          senderName: r.sender_name || r.sender_number,
          userMessage: r.user_message,
          aiResponse: r.ai_response,
          status: r.status,
          latencyMs: r.latency_ms,
          source: r.source || 'ai',
          createdAt: r.created_at,
        }));
      }
    } catch (err) {
      logger.warn({ err }, '[ChatLogger] Failed to query SQLite for recent chats');
    }

    return this.buffer.slice(0, cap);
  }

  /**
   * Retrieves chat activity statistics for the dashboard
   */
  getStats(): ChatStats {
    try {
      const db = localStore.getDatabase();
      if (db) {
        const total = (
          db.prepare(`SELECT COUNT(*) as count FROM _chat_logs`).get() as { count: number }
        )?.count || 0;

        const today = (
          db
            .prepare(
              `SELECT COUNT(*) as count FROM _chat_logs WHERE date(created_at) = date('now') OR date(created_at) = date('now', '+7 hours')`
            )
            .get() as { count: number }
        )?.count || 0;

        const avgRow = db
          .prepare(
            `SELECT AVG(latency_ms) as avg_latency FROM _chat_logs WHERE latency_ms IS NOT NULL AND status = 'replied'`
          )
          .get() as { avg_latency: number | null };

        return {
          totalCount: total,
          todayCount: today,
          avgLatencyMs: Math.round(avgRow?.avg_latency || 0),
        };
      }
    } catch (err) {
      logger.warn({ err }, '[ChatLogger] Failed to calculate chat stats');
    }

    return {
      totalCount: this.buffer.length,
      todayCount: this.buffer.length,
      avgLatencyMs: 0,
    };
  }

  /**
   * Clears all recorded chat activity
   */
  clear(): boolean {
    this.buffer = [];
    try {
      const db = localStore.getDatabase();
      if (db) {
        db.exec(`DELETE FROM _chat_logs;`);
        return true;
      }
    } catch (err) {
      logger.error({ err }, '[ChatLogger] Failed to clear _chat_logs table');
    }
    return false;
  }
}

export const chatLogger = new ChatLogger();
