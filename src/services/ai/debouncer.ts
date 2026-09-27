import type { SerializedMessage } from '../../core/serializer.js';
import { aiService } from './index.js';
import { takeoverManager } from './takeover.js';
import { chatLogger } from '../chat/chatLogger.js';
import { logger } from '../../utils/logger.js';

import { config } from '../../config/index.js';

interface BufferedSession {
  messages: string[];
  timer: NodeJS.Timeout;
  lastMessage: SerializedMessage;
}

export class MessageDebouncer {
  private buffers = new Map<string, BufferedSession>();
  private readonly delayMs: number;

  constructor(delayMs = 2000) {
    this.delayMs = delayMs;
  }

  /**
   * Enqueues an incoming text message into the user's debouncing buffer.
   * If user sends additional messages within delayMs, they are concatenated
   * into a single cohesive prompt before being processed by the AI.
   */
  enqueue(m: SerializedMessage, text: string): void {
    const userId = m.senderNumber;

    // Immediately mark message as read and start typing presence (Apple HIG Instant Feedback)
    m.markRead().catch(() => {});
    m.sendTyping(true).catch(() => {});

    const existing = this.buffers.get(userId);
    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(text);
      existing.lastMessage = m;

      existing.timer = setTimeout(() => {
        this.flush(userId);
      }, this.delayMs);

      logger.debug(
        `[Debouncer] Buffered message for ${userId} (total in buffer: ${existing.messages.length})`
      );
      return;
    }

    const timer = setTimeout(() => {
      this.flush(userId);
    }, this.delayMs);

    this.buffers.set(userId, {
      messages: [text],
      timer,
      lastMessage: m,
    });
  }

  /**
   * Flushes the buffer for a user and dispatches combined prompt to AI
   */
  private async flush(userId: string): Promise<void> {
    const session = this.buffers.get(userId);
    if (!session) return;

    this.buffers.delete(userId);

    // Double check takeover / mute state before sending
    if (takeoverManager.isMuted(userId) || takeoverManager.isMuted(session.lastMessage.from)) {
      session.lastMessage.sendTyping(false).catch(() => {});
      return;
    }

    const combinedPrompt = session.messages.join('\n');
    logger.info(
      `[Debouncer] Processing ${session.messages.length} aggregated message(s) from ${userId}`
    );

    // Start Persistent Typing Indicator Heartbeat (Refreshed every 4s to counter WhatsApp timeout)
    await session.lastMessage.sendTyping(true);
    const typingHeartbeat = setInterval(() => {
      session.lastMessage.sendTyping(true).catch(() => {});
    }, 4000);

    const startTime = Date.now();
    try {
      const response = await aiService.generateResponse(combinedPrompt, {
        sessionId: userId,
      });

      clearInterval(typingHeartbeat);
      await session.lastMessage.sendTyping(false);

      if (response) {
        const latencyMs = Date.now() - startTime;
        logger.info(
          {
            userId,
            response,
            latencyMs,
          },
          '[AI Outbound Response] Sent response to user'
        );

        chatLogger.log({
          sessionId: userId,
          senderNumber: userId,
          senderName: session.lastMessage.pushName || userId,
          userMessage: combinedPrompt,
          aiResponse: response,
          status: 'replied',
          latencyMs,
          source: 'ai',
        });

        await session.lastMessage.reply(response);
      }
    } catch (error: any) {
      clearInterval(typingHeartbeat);
      await session.lastMessage.sendTyping(false);

      const latencyMs = Date.now() - startTime;
      logger.error({ error, userId }, 'Error generating AI response for debounced messages');

      chatLogger.log({
        sessionId: userId,
        senderNumber: userId,
        senderName: session.lastMessage.pushName || userId,
        userMessage: combinedPrompt,
        aiResponse: null,
        status: 'error',
        latencyMs,
        source: 'ai',
      });

      const isRateLimit =
        error?.status === 429 ||
        error?.code === 'rate_limit_exceeded' ||
        String(error?.message || '').toLowerCase().includes('rate limit');
      const isOwner = config.OWNER_NUMBERS.includes(userId);

      const fallbackLines: string[] = [
        isRateLimit ? '*Antrean Layanan Sedang Penuh*' : '*Kendala Sistem Sementara*',
        '',
        isRateLimit
          ? 'Layanan asisten AI sedang mencapai batas antrean sesaat. Mohon tunggu 1–2 menit, atau gunakan bantuan langsung di bawah ini:'
          : 'Asisten AI mengalami kendala teknis sementara. Untuk bantuan langsung, silakan gunakan perintah:',
        '',
        '• `/menu` — Daftar perintah sistem',
        '• `/human` — Hubungkan langsung ke staf/admin',
      ];

      if (isOwner) {
        fallbackLines.push('');
        fallbackLines.push(`_Catatan teknis administrator: ${error?.message || 'Batas kuota/antrean API tercapai'}._`);
      }

      await session.lastMessage.reply(fallbackLines.join('\n')).catch(() => {});
    }
  }

  /**
   * Cancels any pending debounced messages for a user (e.g. if a command is executed)
   */
  cancel(userId: string): void {
    const session = this.buffers.get(userId);
    if (session) {
      clearTimeout(session.timer);
      session.lastMessage.sendTyping(false).catch(() => {});
      this.buffers.delete(userId);
    }
  }
}

export const messageDebouncer = new MessageDebouncer(2000);
