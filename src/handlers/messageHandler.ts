import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { serializeMessage, type SerializedMessage } from '../core/serializer.js';
import { commandManager } from '../core/commandManager.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

import { dispatchWebhook } from '../utils/webhook.js';
import { aiService, takeoverManager } from '../services/ai/index.js';

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

  // If message has command prefix, dispatch to CommandManager
  if (m.hasPrefix && m.command) {
    const executed = await commandManager.execute({
      sock,
      m,
      args: m.args,
      text: m.text,
      config,
    });

    if (executed) return;
  }

  // Autonomous AI Auto-Reply (Private chats, non-command)
  if (!m.hasPrefix && config.AI_AUTO_REPLY && !m.isGroup && m.body) {
    // If chat is currently muted or handled by human agent, skip AI reply
    if (takeoverManager.isMuted(m.senderNumber) || takeoverManager.isMuted(m.from)) {
      return;
    }

    try {
      const response = await aiService.generateResponse(m.body, { sessionId: m.senderNumber });
      if (response) {
        await m.reply(response);
      }
    } catch (error) {
      logger.error({ error }, 'Error in autonomous AI auto-reply');
    }
  }
}
