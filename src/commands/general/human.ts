import type { Command } from '../../types/command.js';
import { takeoverManager } from '../../services/ai/index.js';
import { alertService } from '../../services/alerts/index.js';
import { dispatchWebhook } from '../../utils/webhook.js';
import { logger } from '../../utils/logger.js';

const humanCommand: Command = {
  name: 'human',
  aliases: ['cs', 'admin', 'bantuan'],
  description: 'Request assistance from a human support representative',
  category: 'general',
  execute: async ({ m, sock, text }) => {
    // Mute AI auto-reply for 60 minutes so human agent can handle
    takeoverManager.mute(m.senderNumber, 60, 'customer_manual_command');

    dispatchWebhook('support.requested', {
      from: m.from,
      senderNumber: m.senderNumber,
      senderName: m.pushName,
      timestamp: Math.floor(Date.now() / 1000),
    }).catch(() => {});

    logger.warn(`[Support] Human handover requested by ${m.senderNumber} (${m.pushName})`);

    const timeStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const alertText = [
      `[Eskalasi Admin Diperlukan]`,
      `Pelanggan: +${m.senderNumber} (${m.pushName || 'Pelanggan'})`,
      `Waktu: ${timeStr} WIB`,
      `Pemicu: Perintah manual /${m.command || 'human'}`,
      `Catatan: "${text || '(Tanpa catatan tambahan)'}"`,
    ].join('\n');

    await alertService.notifyOwners(alertText, sock);

    await m.reply('Permintaan Anda telah diteruskan ke admin kami. Tim kami akan segera membantu Anda.');
  },
};

export default humanCommand;
