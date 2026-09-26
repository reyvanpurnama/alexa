import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { serializeMessage, type SerializedMessage } from '../core/serializer.js';
import { commandManager } from '../core/commandManager.js';
import { config } from '../config/index.js';
import { settingsManager } from '../config/settingsManager.js';
import { logger } from '../utils/logger.js';

import { dispatchWebhook } from '../utils/webhook.js';
import { aiService, takeoverManager, messageDebouncer } from '../services/ai/index.js';
import { alertService } from '../services/alerts/index.js';

export { type SerializedMessage };

/**
 * Central Incoming Message Handler
 * Delegates commands to the dynamic modular CommandManager
 */
export async function handleIncomingMessage(sock: WASocket, rawMsg: WAMessage): Promise<void> {
  // Ignore WhatsApp status broadcasts
  if (rawMsg.key.remoteJid === 'status@broadcast') return;

  const m = await serializeMessage(sock, rawMsg);
  if (!m) return;

  // If owner manually replied from their phone in a private chat, auto-snooze AI for 30m
  if (m.fromMe) {
    if (!m.isGroup && m.from) {
      takeoverManager.mute(m.from, 30, 'owner_manual_reply');
    }
    return;
  }

  const senderDisplay = m.isLid && m.senderLid ? `${m.senderNumber} (lid)` : m.senderNumber;
  logger.info(
    `[Inbound] ${m.pushName} (${senderDisplay})${m.isGroup ? ' [group]' : ''}: "${m.body}"`
  );

  // Forward inbound message to external webhook if configured
  dispatchWebhook('message.received', {
    messageId: m.id,
    from: m.from,
    isGroup: m.isGroup,
    senderNumber: m.senderNumber,
    senderLid: m.senderLid,
    senderName: m.pushName,
    body: m.body,
    type: m.type,
    timestamp: m.timestamp,
    hasPrefix: m.hasPrefix,
    command: m.command || null,
  }).catch(() => {});

  // If message has command prefix, cancel pending AI buffer and dispatch to CommandManager
  if (m.hasPrefix && m.command) {
    messageDebouncer.cancel(m.senderNumber);

    const executed = await commandManager.execute({
      sock,
      m,
      args: m.args,
      text: m.text,
      config,
    });

    if (executed) return;
  }

  // Autonomous AI Auto-Reply & Media / Lead Alerts (Private chats, non-command)
  if (!m.hasPrefix && !m.isGroup) {
    // 1. Payment Receipt Detection & Real-time Owner Forwarding
    const isMedia = m.type === 'image' || m.type === 'document';
    if (isMedia && alertService.isPaymentReceiptIntent(m.body)) {
      const timeStr = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      const alertHeader = [
        `[Notifikasi Bukti Pembayaran]`,
        `Pelanggan: +${m.senderNumber} (${m.pushName || 'Pelanggan'})`,
        `Waktu: ${timeStr} WIB`,
        `Keterangan: "${m.body || '(Tanpa keterangan)'}"`,
      ].join('\n');

      // Forward media to owners
      await alertService.forwardToOwners(rawMsg, alertHeader, sock);

      // Auto-mute AI for 60m so human admin can verify & confirm order
      takeoverManager.mute(m.from, 60, 'payment_verification');
      takeoverManager.mute(m.senderNumber, 60, 'payment_verification');

      // Dispatch webhook
      dispatchWebhook('payment.received', {
        from: m.from,
        senderNumber: m.senderNumber,
        senderName: m.pushName,
        caption: m.body,
        messageId: m.id,
        type: m.type,
        timestamp: Math.floor(Date.now() / 1000),
      }).catch(() => {});

      await m.reply(
        'Terima kasih. Bukti pembayaran Anda telah kami terima dan diteruskan ke tim admin untuk verifikasi. Mohon tunggu konfirmasi selanjutnya.'
      );
      return;
    }

    if (settingsManager.getSettings().aiAutoReply) {
      // If chat is currently muted or handled by human agent, skip AI reply
      if (takeoverManager.isMuted(m.senderNumber) || takeoverManager.isMuted(m.from)) {
        return;
      }

      // 2. Fallback for Voice Note / Audio
      if (m.type === 'audio') {
        await m.reply(
          'Saat ini asisten belum dapat memproses pesan suara secara langsung. Mohon ketikkan pesan Anda dalam bentuk teks, atau ketik /human untuk berbicara dengan admin.'
        );
        return;
      }

      // 3. Fallback for Media (Image / Video / Document) without text caption
      if ((m.type === 'image' || m.type === 'video' || m.type === 'document') && !m.body) {
        await m.reply(
          'Terima kasih atas lampiran yang Anda kirimkan. Mohon sertakan keterangan atau pertanyaan mengenai lampiran tersebut, atau ketik /human untuk bantuan admin.'
        );
        return;
      }

      // 4. Process text or captioned media through the Debouncing Buffer (handles rapid bursts)
      if (m.body) {
        const promptText =
          m.type === 'image' || m.type === 'video'
            ? `[Pelanggan melampirkan foto/video produk]: ${m.body}`
            : m.body;

        messageDebouncer.enqueue(m, promptText);
      }
    }
  }
}
