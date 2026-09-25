import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { serializeMessage, type SerializedMessage } from '../core/serializer.js';
import { commandManager } from '../core/commandManager.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

import { dispatchWebhook } from '../utils/webhook.js';

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

  // Do not reply to own messages
  if (m.fromMe) return;

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

  // NOTE: Future AI assistant or conversational fallback can be placed here!
}
