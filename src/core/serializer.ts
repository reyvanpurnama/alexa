import type { WAMessage, WASocket, proto, AnyMessageContent } from '@whiskeysockets/baileys';
import type { WAMessageKey } from '@whiskeysockets/baileys/lib/Types/Message.js';
import { config } from '../config/index.js';
import { settingsManager } from '../config/settingsManager.js';

export interface QuotedMessage {
  id: string;
  sender: string;
  senderNumber: string;
  senderLid?: string;
  body: string;
  type: string;
  isMedia: boolean;
  raw: proto.IMessage;
}

export interface SerializedMessage {
  raw: WAMessage;
  id: string;
  from: string;
  isGroup: boolean;
  sender: string;
  senderNumber: string;
  senderLid?: string;
  isLid: boolean;
  pushName: string;
  fromMe: boolean;
  isOwner: boolean;
  timestamp: number;
  type: string;
  body: string;

  // Command & Parsing
  hasPrefix: boolean;
  prefix: string;
  command: string;
  args: string[];
  text: string;

  // Quoted message (if user replied to another message)
  quoted: QuotedMessage | null;

  // DX Action Helpers
  reply: (text: string, options?: { withFooter?: boolean }) => Promise<WAMessage | undefined>;
  react: (emoji: string) => Promise<WAMessage | undefined>;
  send: (content: AnyMessageContent) => Promise<WAMessage | undefined>;
}

/**
 * Extracts text content from a Baileys message object
 */
function extractBody(content: proto.IMessage | null | undefined): { body: string; type: string } {
  if (!content) return { body: '', type: 'empty' };

  if (content.conversation) {
    return { body: content.conversation, type: 'text' };
  }
  if (content.extendedTextMessage?.text) {
    return { body: content.extendedTextMessage.text, type: 'text' };
  }
  if (content.imageMessage) {
    return { body: content.imageMessage.caption || '', type: 'image' };
  }
  if (content.videoMessage) {
    return { body: content.videoMessage.caption || '', type: 'video' };
  }
  if (content.documentMessage) {
    return {
      body: content.documentMessage.caption || content.documentMessage.fileName || '',
      type: 'document',
    };
  }
  if (content.audioMessage) {
    return { body: '', type: 'audio' };
  }
  if (content.stickerMessage) {
    return { body: '', type: 'sticker' };
  }

  return { body: '', type: 'unknown' };
}

/**
 * Resolves real phone number from WhatsApp LID (Linked Identity JID) or standard PN
 */
async function resolveSenderDetails(
  sock: WASocket,
  msg: WAMessage,
  isGroup: boolean,
  from: string
): Promise<{
  sender: string;
  senderNumber: string;
  senderLid?: string;
  isLid: boolean;
}> {
  const key = msg.key as WAMessageKey;
  const primarySender = isGroup ? (key.participant || from) : from;
  const altSender = isGroup ? key.participantAlt : key.remoteJidAlt;

  let sender = primarySender;
  let senderNumber = primarySender.replace(/[:@].*$/, '').replace(/\D/g, '');
  let senderLid: string | undefined;
  let isLid = false;

  // WhatsApp v7+ LID Check (@lid)
  if (primarySender.endsWith('@lid')) {
    isLid = true;
    senderLid = primarySender;

    // 1. Check if WhatsApp provided the alternative Phone Number JID in remoteJidAlt / participantAlt
    if (altSender && altSender.endsWith('@s.whatsapp.net')) {
      senderNumber = altSender.replace(/[:@].*$/, '').replace(/\D/g, '');
    } else {
      // 2. Query Baileys internal signalRepository LID Mapping Cache
      try {
        const signalRepo = (sock as any).signalRepository;
        if (signalRepo?.lidMapping?.getPNForLID) {
          const mappedPn = await signalRepo.lidMapping.getPNForLID(primarySender);
          if (mappedPn) {
            senderNumber = mappedPn.replace(/[:@].*$/, '').replace(/\D/g, '');
          }
        }
      } catch {
        // Fallback to LID digits if mapping not yet available
      }
    }
  } else if (altSender?.endsWith('@lid')) {
    senderLid = altSender;
  }

  return { sender, senderNumber, senderLid, isLid };
}

/**
 * Serializes raw Baileys WAMessage into a clean, developer-friendly interface
 */
export async function serializeMessage(sock: WASocket, msg: WAMessage): Promise<SerializedMessage | null> {
  if (!msg.message || !msg.key.remoteJid) return null;

  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  const fromMe = msg.key.fromMe ?? false;
  const id = msg.key.id || '';
  const pushName = msg.pushName || 'Unknown';
  const timestamp = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000);

  // Resolve sender details and handle WhatsApp LID mapping
  const { sender, senderNumber, senderLid, isLid } = await resolveSenderDetails(sock, msg, isGroup, from);

  // Owner check based on dynamic settingsManager (supports matching both PN and LID)
  const isOwner =
    fromMe ||
    settingsManager.isOwner(senderNumber) ||
    (senderLid ? settingsManager.isOwner(senderLid.replace(/\D/g, '')) : false);

  // Extract body and type
  const { body, type } = extractBody(msg.message);

  // Command & prefix parsing
  const cleanBody = body.trim();
  const configuredPrefix = settingsManager.getSettings().prefix || config.PREFIX;
  const hasPrefix = cleanBody.startsWith(configuredPrefix);

  const strippedBody = hasPrefix ? cleanBody.slice(configuredPrefix.length).trim() : cleanBody;
  const parts = strippedBody.split(/\s+/);
  const command = (hasPrefix && parts[0]) ? parts[0].toLowerCase() : '';
  const args = hasPrefix ? parts.slice(1) : parts;
  const text = args.join(' ');

  // Parse quoted message if available
  let quoted: QuotedMessage | null = null;
  const contextInfo =
    msg.message.extendedTextMessage?.contextInfo ||
    msg.message.imageMessage?.contextInfo ||
    msg.message.videoMessage?.contextInfo ||
    msg.message.documentMessage?.contextInfo;

  if (contextInfo?.quotedMessage && contextInfo.stanzaId) {
    const quotedSender = contextInfo.participant || from;
    let quotedSenderNumber = quotedSender.replace(/[:@].*$/, '').replace(/\D/g, '');
    let quotedSenderLid: string | undefined;

    if (quotedSender.endsWith('@lid')) {
      quotedSenderLid = quotedSender;
      try {
        const signalRepo = (sock as any).signalRepository;
        const mappedPn = await signalRepo?.lidMapping?.getPNForLID(quotedSender);
        if (mappedPn) {
          quotedSenderNumber = mappedPn.replace(/[:@].*$/, '').replace(/\D/g, '');
        }
      } catch {
        // Fallback
      }
    }

    const quotedContent = extractBody(contextInfo.quotedMessage);
    quoted = {
      id: contextInfo.stanzaId,
      sender: quotedSender,
      senderNumber: quotedSenderNumber,
      senderLid: quotedSenderLid,
      body: quotedContent.body,
      type: quotedContent.type,
      isMedia: ['image', 'video', 'document', 'audio', 'sticker'].includes(quotedContent.type),
      raw: contextInfo.quotedMessage,
    };
  }

  // Developer action helpers
  const reply = async (replyText: string, options?: { withFooter?: boolean }) => {
    let finalContent = replyText;
    const currentFooter = settingsManager.getSettings().footerText;
    if (options?.withFooter && currentFooter) {
      finalContent = `${replyText}\n\n${currentFooter}`;
    }
    return await sock.sendMessage(from, { text: finalContent }, { quoted: msg });
  };

  const react = async (emoji: string) => {
    return await sock.sendMessage(from, {
      react: {
        text: emoji,
        key: msg.key,
      },
    });
  };

  const send = async (content: AnyMessageContent) => {
    return await sock.sendMessage(from, content);
  };

  return {
    raw: msg,
    id,
    from,
    isGroup,
    sender,
    senderNumber,
    senderLid,
    isLid,
    pushName,
    fromMe,
    isOwner,
    timestamp,
    type,
    body: cleanBody,
    hasPrefix,
    prefix: configuredPrefix,
    command,
    args,
    text,
    quoted,
    reply,
    react,
    send,
  };
}
