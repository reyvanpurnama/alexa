import { logger } from '../../utils/logger.js';

export interface MuteSession {
  until: number;
  reason: string;
  mutedAt: number;
}

export interface MutedSessionInfo {
  id: string;
  phone: string;
  remainingMinutes: number;
  remainingSeconds: number;
  reason: string;
  reasonLabel: string;
  mutedAt: number;
  until: number;
}

export class TakeoverManager {
  private mutedSessions = new Map<string, MuteSession>();

  /**
   * Translates internal reason code to a human-readable label
   */
  private getReasonLabel(reason: string): string {
    switch (reason) {
      case 'customer_manual_command':
        return 'Permintaan Pelanggan (/human)';
      case 'payment_verification':
        return 'Verifikasi Bukti Pembayaran';
      case 'owner_manual_reply':
        return 'Balasan Manual Owner (WhatsApp)';
      case 'owner_command_mute':
        return 'Perintah Manual /mute';
      case 'ai_escalation':
        return 'Eskalasi Otomatis AI ke Admin';
      default:
        return reason || 'Manual Takeover';
    }
  }

  /**
   * Mute AI responses for a specific chat or user
   * @param targetId Phone number or remoteJid (e.g. 628123456789 or 628123456789@s.whatsapp.net)
   * @param durationMinutes Duration to keep AI muted (default: 30 minutes)
   * @param reason Contextual reason for audit logging
   */
  mute(targetId: string, durationMinutes = 30, reason = 'manual_takeover'): void {
    const cleanId = targetId.replace(/@s\.whatsapp\.net|@lid/, '').replace(/\D/g, '');
    const now = Date.now();
    const until = now + durationMinutes * 60 * 1000;

    this.mutedSessions.set(cleanId, { until, reason, mutedAt: now });
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
   * Unmute all currently muted chats and restore full autonomous AI mode
   */
  unmuteAll(): number {
    const count = this.mutedSessions.size;
    this.mutedSessions.clear();
    logger.info(`[Takeover] AI auto-reply unmuted for all ${count} session(s). Full autonomous mode restored.`);
    return count;
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
   * Get detailed mute information for a single chat
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

  /**
   * Retrieves all currently active muted sessions with remaining time and context
   */
  getAllMuted(): MutedSessionInfo[] {
    const now = Date.now();
    const results: MutedSessionInfo[] = [];

    for (const [id, session] of this.mutedSessions.entries()) {
      const remainingMs = session.until - now;
      if (remainingMs <= 0) {
        this.mutedSessions.delete(id);
        continue;
      }

      results.push({
        id,
        phone: id.startsWith('+') ? id : `+${id}`,
        remainingMinutes: Math.ceil(remainingMs / (60 * 1000)),
        remainingSeconds: Math.ceil(remainingMs / 1000),
        reason: session.reason,
        reasonLabel: this.getReasonLabel(session.reason),
        mutedAt: session.mutedAt || now - 60000,
        until: session.until,
      });
    }

    // Sort by expiration time ascending (soonest to expire first)
    return results.sort((a, b) => a.until - b.until);
  }
}

export const takeoverManager = new TakeoverManager();
