import type { WASocket, WAMessage } from '@whiskeysockets/baileys';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { formatToWhatsAppJid } from '../../utils/jid.js';
import { waClient } from '../../core/whatsapp.js';

export class AlertService {
  /**
   * Broadcasts an administrative notification to all configured OWNER_NUMBERS
   * Uses provided sock or falls back to active waClient socket
   */
  async notifyOwners(alertText: string, sock?: WASocket | null): Promise<void> {
    const owners = config.OWNER_NUMBERS;
    if (!owners || owners.length === 0) {
      logger.debug('[AlertService] No OWNER_NUMBERS configured. Skipping alert dispatch.');
      return;
    }

    const activeSock = sock || waClient.getSocket();
    if (!activeSock) {
      logger.warn('[AlertService] Cannot notify owners: WhatsApp socket is not connected');
      return;
    }

    for (const ownerPhone of owners) {
      try {
        const jid = formatToWhatsAppJid(ownerPhone);
        await activeSock.sendMessage(jid, { text: alertText });
        logger.info(`[AlertService] Dispatched owner alert to +${ownerPhone}`);
      } catch (err) {
        logger.error({ err, ownerPhone }, '[AlertService] Failed to notify owner');
      }
    }
  }

  /**
   * Forwards a customer message (e.g. payment receipt) to all configured OWNER_NUMBERS
   */
  async forwardToOwners(rawMsg: WAMessage, headerNote: string, sock?: WASocket | null): Promise<void> {
    const owners = config.OWNER_NUMBERS;
    if (!owners || owners.length === 0) {
      logger.debug('[AlertService] No OWNER_NUMBERS configured. Skipping forwarder.');
      return;
    }

    const activeSock = sock || waClient.getSocket();
    if (!activeSock) {
      logger.warn('[AlertService] Cannot forward to owners: WhatsApp socket is not connected');
      return;
    }

    for (const ownerPhone of owners) {
      try {
        const jid = formatToWhatsAppJid(ownerPhone);

        // 1. Send introductory context header
        await activeSock.sendMessage(jid, { text: headerNote });

        // 2. Forward the exact customer message with media/image intact
        await activeSock.sendMessage(jid, { forward: rawMsg });

        logger.info(`[AlertService] Forwarded customer media to owner +${ownerPhone}`);
      } catch (err) {
        logger.error({ err, ownerPhone }, '[AlertService] Failed to forward media to owner');
      }
    }
  }

  /**
   * Detects if an inbound message or caption represents a payment transfer proof
   */
  isPaymentReceiptIntent(text?: string | null): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    // Normalize underscores, hyphens, and dots to spaces for filename matching
    const normalized = lower.replace(/[-_.]/g, ' ');

    // Exact word boundary matches for short bank codes and acronyms
    const shortWordRegex = /\b(tf|struk|nota|qris|bca|bri|bni|bsi|cimb|seabank|jago)\b/i;
    if (shortWordRegex.test(normalized)) return true;

    // Substring keywords for common Indonesian & English payment terms
    const explicitKeywords = [
      'bukti',
      'transfer',
      'pembayaran',
      'bayar',
      'lunas',
      'receipt',
      'invoice',
      'transaksi',
      'nominal',
      'rekening',
      'pengiriman dana',
      'bukti tf',
      'sudah tf',
      'udah tf',
    ];
    return explicitKeywords.some((kw) => normalized.includes(kw));
  }
}

export const alertService = new AlertService();
