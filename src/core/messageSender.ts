import type { WASocket, AnyMessageContent } from '@whiskeysockets/baileys';
import { logger } from '../utils/logger.js';
import { formatToWhatsAppJid, formatPhoneNumberForPairing } from '../utils/jid.js';
import { messageQueue } from '../queue/messageQueue.js';

export interface SendMediaParams {
  type: 'image' | 'video' | 'audio' | 'document';
  url?: string;
  buffer?: Buffer;
  caption?: string;
  fileName?: string;
  mimetype?: string;
}

export class MessageSender {
  /**
   * Verify if a phone number is registered on WhatsApp
   */
  async checkNumber(
    sock: WASocket,
    phoneNumber: string
  ): Promise<{ registered: boolean; jid: string | null }> {
    const cleanPhone = formatPhoneNumberForPairing(phoneNumber);
    if (!cleanPhone) {
      throw new Error('Invalid phone number format');
    }

    try {
      const results = await sock.onWhatsApp(cleanPhone);
      const target = results?.[0];

      if (target?.exists) {
        return { registered: true, jid: target.jid };
      }

      return { registered: false, jid: null };
    } catch (err) {
      logger.error({ err, phoneNumber }, 'Error checking WhatsApp number');
      throw err;
    }
  }

  /**
   * Send a text message to a user or group JID
   */
  async sendText(
    sock: WASocket,
    target: string,
    text: string,
    options: { queued?: boolean } = { queued: true }
  ) {
    const jid = formatToWhatsAppJid(target);

    const task = async () => {
      logger.info(`Sending message to ${jid}`);
      return await sock.sendMessage(jid, { text });
    };

    if (options.queued) {
      return await messageQueue.add(task);
    } else {
      return await task();
    }
  }

  /**
   * Send media (image, video, document, audio) to target
   */
  async sendMedia(
    sock: WASocket,
    target: string,
    params: SendMediaParams,
    options: { queued?: boolean } = { queued: true }
  ) {
    const jid = formatToWhatsAppJid(target);
    let mediaContent: AnyMessageContent;

    const mediaPayload = params.url ? { url: params.url } : params.buffer!;

    switch (params.type) {
      case 'image':
        mediaContent = {
          image: mediaPayload,
          caption: params.caption,
          mimetype: params.mimetype || 'image/jpeg',
        };
        break;
      case 'video':
        mediaContent = {
          video: mediaPayload,
          caption: params.caption,
          mimetype: params.mimetype || 'video/mp4',
        };
        break;
      case 'audio':
        mediaContent = {
          audio: mediaPayload,
          mimetype: params.mimetype || 'audio/mp4',
        };
        break;
      case 'document':
        mediaContent = {
          document: mediaPayload,
          caption: params.caption,
          mimetype: params.mimetype || 'application/pdf',
          fileName: params.fileName || 'document.pdf',
        };
        break;
      default:
        throw new Error(`Unsupported media type: ${(params as { type: string }).type}`);
    }

    const task = async () => {
      logger.info(`Sending ${params.type} to ${jid}`);
      return await sock.sendMessage(jid, mediaContent);
    };

    if (options.queued) {
      return await messageQueue.add(task);
    } else {
      return await task();
    }
  }
}

export const messageSender = new MessageSender();
