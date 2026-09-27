import { logger } from '../../utils/logger.js';
import { localStore } from '../../core/store/localStore.js';
import { formatPhoneNumber } from '../../utils/jid.js';

export interface MuteSession {
  until: number;
  reason: string;
  mutedAt: number;
  senderName?: string;
}

export interface MutedSessionInfo {
  id: string;
  phone: string;
  formattedPhone: string;
  senderName: string;
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
   * Normalizes target ID to standard numeric format (e.g. 628xxx)
   */
  private normalizeId(targetId: string): string {
    let cleanId = targetId.replace(/@s\.whatsapp\.net|@lid|@g\.us/g, '').replace(/\D/g, '');
    if (cleanId.startsWith('0')) {
      cleanId = '62' + cleanId.slice(1);
    }
    return cleanId;
  }

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
   * Looks up latest known sender name from chat log database
   */
  private resolveSenderNameFromDb(cleanId: string): string | undefined {
    try {
      const db = localStore.getDatabase();
      if (!db) return undefined;

      const row = db
        .prepare(
          `SELECT sender_name FROM _chat_logs 
           WHERE sender_number = ? AND sender_name IS NOT NULL AND sender_name != '' AND sender_name != sender_number 
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(cleanId) as { sender_name?: string } | undefined;

      return row?.sender_name?.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Mute AI responses for a specific chat or user
   * @param targetId Phone number or remoteJid (e.g. 628123456789 or 628123456789@s.whatsapp.net)
   * @param durationMinutes Duration to keep AI muted (default: 30 minutes)
   * @param reason Contextual reason for audit logging
   * @param senderName Optional contact/pushName
   */
  mute(
    targetId: string,
    durationMinutes = 30,
    reason = 'manual_takeover',
    senderName?: string
  ): void {
    const cleanId = this.normalizeId(targetId);
    const now = Date.now();
    const until = now + durationMinutes * 60 * 1000;

    let resolvedName = senderName?.trim();
    if (!resolvedName || resolvedName === cleanId) {
      resolvedName = this.resolveSenderNameFromDb(cleanId);
    }

    this.mutedSessions.set(cleanId, {
      until,
      reason,
      mutedAt: now,
      senderName: resolvedName,
    });

    const displayInfo = resolvedName ? `${resolvedName} (${cleanId})` : cleanId;
    logger.info(
      `[Takeover] AI auto-reply muted for ${displayInfo} for ${durationMinutes}m. Reason: ${reason}`
    );
  }

  /**
   * Unmute and immediately resume AI auto-reply for a chat
   */
  unmute(targetId: string): boolean {
    const cleanId = this.normalizeId(targetId);
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
    const cleanId = this.normalizeId(targetId);
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
    const cleanId = this.normalizeId(targetId);
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

      // If senderName wasn't cached, try resolving from DB
      let displayName = session.senderName;
      if (!displayName || displayName === id) {
        displayName = this.resolveSenderNameFromDb(id);
        if (displayName) {
          session.senderName = displayName;
        }
      }

      const formatted = formatPhoneNumber(id);

      results.push({
        id,
        phone: id.startsWith('+') ? id : `+${id}`,
        formattedPhone: formatted,
        senderName: displayName || formatted,
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
