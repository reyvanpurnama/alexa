import type { WASocket, AnyMessageContent } from '@whiskeysockets/baileys';
import { logger } from '../utils/logger.js';
import { formatToWhatsAppJid, formatPhoneNumberForPairing } from '../utils/jid.js';
import { messageQueue } from '../queue/messageQueue.js';
import { messageTracker } from '../services/messages/messageTracker.js';

export interface SendMediaParams {
  type: 'image' | 'video' | 'audio' | 'document';
  url?: string;
  buffer?: Buffer;
  caption?: string;
  fileName?: string;
  mimetype?: string;
}

export interface SendMessageOptions {
  queued?: boolean;
  referenceId?: string;
  messageId?: string;
}

export interface SendMessageResult {
  messageId: string;
  referenceId?: string;
  status: 'queued' | 'sent';
  to: string;
  queued: boolean;
  result?: unknown;
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
   * Send a text message to a user or group JID with queue tracing & referenceId
   */
  async sendText(
    sock: WASocket,
    target: string,
    text: string,
    options: SendMessageOptions = { queued: true }
  ): Promise<SendMessageResult> {
    const jid = formatToWhatsAppJid(target);
    const isQueued = options.queued ?? true;
    const messageId = options.messageId || messageTracker.generateId(sock.user?.id);

    // Register upfront in Message Tracker
    messageTracker.register({
      messageId,
      referenceId: options.referenceId,
      to: jid,
      type: 'text',
      initialStatus: isQueued ? 'queued' : 'sent',
    });

    const executeSend = async () => {
      logger.info(`Sending message to ${jid} (id: ${messageId})`);
      try {
        const result = await sock.sendMessage(jid, { text }, { messageId });
        messageTracker.updateStatus(messageId, 'sent');
        return result;
      } catch (err: unknown) {
        messageTracker.updateStatus(
          messageId,
          'failed',
          (err as Error)?.message || 'Failed to send text message'
        );
        throw err;
      }
    };

    if (isQueued) {
      // Non-blocking in-memory queue: enqueue task in background
      messageQueue.add(executeSend).catch((err) => {
        logger.error({ err, messageId, jid }, '[MessageSender] Queued text send failed');
      });

      return {
        messageId,
        referenceId: options.referenceId,
        status: 'queued',
        to: jid,
        queued: true,
      };
    } else {
      // Synchronous immediate send
      const result = await executeSend();
      return {
        messageId,
        referenceId: options.referenceId,
        status: 'sent',
        to: jid,
        queued: false,
        result,
      };
    }
  }

  /**
   * Send media (image, video, document, audio) to target with queue tracing
   */
  async sendMedia(
    sock: WASocket,
    target: string,
    params: SendMediaParams,
    options: SendMessageOptions = { queued: true }
  ): Promise<SendMessageResult> {
    const jid = formatToWhatsAppJid(target);
    const isQueued = options.queued ?? true;
    const messageId = options.messageId || messageTracker.generateId(sock.user?.id);

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

    // Register upfront in Message Tracker
    messageTracker.register({
      messageId,
      referenceId: options.referenceId,
      to: jid,
      type: 'media',
      initialStatus: isQueued ? 'queued' : 'sent',
    });

    const executeSend = async () => {
      logger.info(`Sending ${params.type} to ${jid} (id: ${messageId})`);
      try {
        const result = await sock.sendMessage(jid, mediaContent, { messageId });
        messageTracker.updateStatus(messageId, 'sent');
        return result;
      } catch (err: unknown) {
        messageTracker.updateStatus(
          messageId,
          'failed',
          (err as Error)?.message || `Failed to send ${params.type} media`
        );
        throw err;
      }
    };

    if (isQueued) {
      // Non-blocking in-memory queue: enqueue task in background
      messageQueue.add(executeSend).catch((err) => {
        logger.error({ err, messageId, jid }, '[MessageSender] Queued media send failed');
      });

      return {
        messageId,
        referenceId: options.referenceId,
        status: 'queued',
        to: jid,
        queued: true,
      };
    } else {
      // Synchronous immediate send
      const result = await executeSend();
      return {
        messageId,
        referenceId: options.referenceId,
        status: 'sent',
        to: jid,
        queued: false,
        result,
      };
    }
  }
}

export const messageSender = new MessageSender();
