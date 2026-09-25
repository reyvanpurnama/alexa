import type { Command } from '../../types/command.js';
import { takeoverManager } from '../../services/ai/index.js';
import { dispatchWebhook } from '../../utils/webhook.js';
import { logger } from '../../utils/logger.js';

const humanCommand: Command = {
  name: 'human',
  aliases: ['cs', 'admin', 'bantuan'],
  description: 'Request assistance from a human support representative',
  category: 'general',
  execute: async ({ m }) => {
    // Mute AI auto-reply for 60 minutes so human agent can handle
    takeoverManager.mute(m.senderNumber, 60, 'customer_manual_command');

    dispatchWebhook('support.requested', {
      from: m.from,
      senderNumber: m.senderNumber,
      senderName: m.pushName,
      timestamp: Math.floor(Date.now() / 1000),
    }).catch(() => {});

    logger.warn(`[Support] Human handover requested by ${m.senderNumber} (${m.pushName})`);

    await m.reply('Your request has been forwarded to our support team. An agent will assist you shortly.');
  },
};

export default humanCommand;
