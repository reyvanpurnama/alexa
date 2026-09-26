import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface SessionProfile {
  name: string;
  isActive: boolean;
  registered: boolean;
  phoneNumber: string | null;
  pushName: string | null;
}

export class SessionManager {
  private baseSessionsDir = path.join(process.cwd(), 'sessions');
  private currentSessionName: string = config.SESSION_NAME || 'alexa_session';

  constructor() {
    this.ensureBaseDir();
  }

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.baseSessionsDir)) {
      fs.mkdirSync(this.baseSessionsDir, { recursive: true });
    }
  }

  getActiveSessionName(): string {
    return this.currentSessionName;
  }

  setActiveSessionName(name: string): void {
    this.currentSessionName = this.sanitizeSessionName(name);
  }

  getSessionDir(sessionName?: string): string {
    const target = sessionName ? this.sanitizeSessionName(sessionName) : this.currentSessionName;
    const dir = path.join(this.baseSessionsDir, target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  sanitizeSessionName(name: string): string {
    const clean = name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!clean) {
      throw new Error('Invalid session name. Use alphanumeric characters, hyphens, and underscores.');
    }
    return clean;
  }

  sessionExists(sessionName: string): boolean {
    const clean = this.sanitizeSessionName(sessionName);
    const targetDir = path.join(this.baseSessionsDir, clean);
    return fs.existsSync(targetDir) && fs.existsSync(path.join(targetDir, 'creds.json'));
  }

  /**
   * Scans sessions/ directory and retrieves all profiles with metadata
   */
  listSessions(): SessionProfile[] {
    this.ensureBaseDir();
    const entries = fs.readdirSync(this.baseSessionsDir, { withFileTypes: true });
    const result: SessionProfile[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sessionName = entry.name;
        const credsPath = path.join(this.baseSessionsDir, sessionName, 'creds.json');
        let registered = false;
        let phoneNumber: string | null = null;
        let pushName: string | null = null;

        if (fs.existsSync(credsPath)) {
          try {
            const raw = fs.readFileSync(credsPath, 'utf-8');
            const data = JSON.parse(raw);
            registered = Boolean(data.registered);
            if (data.me?.id) {
              phoneNumber = data.me.id.split(':')[0].replace(/\D/g, '') || null;
            }
            if (data.me?.name) {
              pushName = data.me.name;
            }
          } catch {}
        }

        result.push({
          name: sessionName,
          isActive: sessionName === this.currentSessionName,
          registered,
          phoneNumber,
          pushName,
        });
      }
    }

    return result;
  }

  /**
   * Safely clears credentials of a session and recreates an empty directory
   * to avoid ENOENT errors during Baileys async creds saving.
   */
  wipeSession(sessionName?: string): void {
    const targetDir = this.getSessionDir(sessionName);
    try {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        fs.mkdirSync(targetDir, { recursive: true });
        logger.info(`[SessionManager] Wiped session files in ${targetDir}`);
      }
    } catch (err) {
      logger.error({ err }, `[SessionManager] Failed to wipe session directory ${targetDir}`);
    }
  }

  /**
   * Deletes a saved session profile from disk. Active session cannot be deleted.
   */
  deleteSession(sessionName: string): boolean {
    const clean = this.sanitizeSessionName(sessionName);

    if (clean === this.currentSessionName) {
      throw new Error('Cannot delete the active session. Switch to another session first.');
    }

    const targetDir = path.join(this.baseSessionsDir, clean);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      logger.info(`[SessionManager] Deleted session profile: ${clean}`);
      return true;
    }

    return false;
  }
}

export const sessionManager = new SessionManager();
