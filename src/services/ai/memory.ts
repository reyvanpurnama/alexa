import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface SessionData {
  messages: ChatMessage[];
  lastActivity: number;
}

export class ConversationMemoryManager {
  private sessions = new Map<string, SessionData>();
  private readonly maxHistory: number;
  private readonly timeoutMs: number;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(maxHistory = config.AI_MAX_HISTORY || 6, timeoutMinutes = config.AI_SESSION_TIMEOUT_MIN || 15) {
    this.maxHistory = maxHistory;
    this.timeoutMs = timeoutMinutes * 60 * 1000;

    // Run sweep every 5 minutes to release inactive session memory
    this.sweepTimer = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);

    if (this.sweepTimer.unref) {
      this.sweepTimer.unref();
    }
  }

  /**
   * Retrieves active conversation history for a given session.
   * If session exceeded TTL, it is automatically evicted.
   */
  getHistory(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const now = Date.now();
    if (now - session.lastActivity > this.timeoutMs) {
      this.sessions.delete(sessionId);
      return [];
    }

    session.lastActivity = now;
    return [...session.messages];
  }

  /**
   * Records a user or assistant message to the session's sliding window.
   */
  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): void {
    const now = Date.now();
    let session = this.sessions.get(sessionId);

    if (!session || now - session.lastActivity > this.timeoutMs) {
      session = { messages: [], lastActivity: now };
      this.sessions.set(sessionId, session);
    }

    session.messages.push({
      role,
      content,
      timestamp: now,
    });

    session.lastActivity = now;

    // Enforce sliding window capacity
    if (session.messages.length > this.maxHistory) {
      session.messages = session.messages.slice(-this.maxHistory);
    }
  }

  /**
   * Clears conversation history for a specific session.
   * Returns true if a session was found and removed.
   */
  clearHistory(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Checks whether a session has active conversation context.
   */
  hasHistory(sessionId: string): boolean {
    const history = this.getHistory(sessionId);
    return history.length > 0;
  }

  /**
   * Evicts all expired sessions from memory.
   */
  cleanupExpired(): void {
    const now = Date.now();
    let evictedCount = 0;

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.timeoutMs) {
        this.sessions.delete(id);
        evictedCount++;
      }
    }

    if (evictedCount > 0) {
      logger.debug(`[AI Memory] Evicted ${evictedCount} expired conversation sessions.`);
    }
  }

  /**
   * Returns runtime statistics of active sessions.
   */
  getStats(): { totalSessions: number } {
    return {
      totalSessions: this.sessions.size,
    };
  }
}

export const conversationMemory = new ConversationMemoryManager();
