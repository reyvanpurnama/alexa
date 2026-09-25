import { logger } from '../../utils/logger.js';

export interface MuteSession {
  until: number;
  reason: string;
}

export class TakeoverManager {
  private mutedSessions = new Map<string, MuteSession>();

  /**
   * Mute AI responses for a specific chat or user
   * @param targetId Phone number or remoteJid (e.g. 628123456789 or 628123456789@s.whatsapp.net)
   * @param durationMinutes Duration to keep AI muted (default: 30 minutes)
   * @param reason Contextual reason for audit logging
   */
  mute(targetId: string, durationMinutes = 30, reason = 'manual_takeover'): void {
    const cleanId = targetId.replace(/@s\.whatsapp\.net|@lid/, '').replace(/\D/g, '');
    const until = Date.now() + durationMinutes * 60 * 1000;

    this.mutedSessions.set(cleanId, { until, reason });
    logger.info(`[Takeover] AI auto-reply muted for ${cleanId} for ${durationMinutes}m. Reason: ${reason}`);
  }

  /**
   * Unmute and immediately resume AI auto-reply for a chat
   */
  unmute(targetId: string): boolean {
    const cleanId = targetId.replace(/@s\.whatsapp\.net|@lid/, '').replace(/\D/g, '');
    const existed = this.mutedSessions.delete(cleanId);
    if (existed) {
      logger.info(`[Takeover] AI auto-reply unmuted for ${cleanId}. Resuming autonomous mode.`);
    }
    return existed;
  }

  /**
   * Check if a chat or user is currently muted
   */
  isMuted(targetId: string): boolean {
    const cleanId = targetId.replace(/@s\.whatsapp\.net|@lid/, '').replace(/\D/g, '');
    const session = this.mutedSessions.get(cleanId);
    if (!session) return false;

    if (Date.now() > session.until) {
      this.mutedSessions.delete(cleanId);
      logger.info(`[Takeover] Mute expired for ${cleanId}. Autonomous mode restored.`);
      return false;
    }

    return true;
  }

  /**
   * Get detailed mute information
   */
  getMuteInfo(targetId: string): { isMuted: boolean; remainingMinutes: number; reason?: string } {
    const cleanId = targetId.replace(/@s\.whatsapp\.net|@lid/, '').replace(/\D/g, '');
    const session = this.mutedSessions.get(cleanId);
    if (!session) return { isMuted: false, remainingMinutes: 0 };

    const remainingMs = session.until - Date.now();
    if (remainingMs <= 0) {
      this.mutedSessions.delete(cleanId);
      return { isMuted: false, remainingMinutes: 0 };
    }

    return {
      isMuted: true,
      remainingMinutes: Math.ceil(remainingMs / (60 * 1000)),
      reason: session.reason,
    };
  }
}

export const takeoverManager = new TakeoverManager();
