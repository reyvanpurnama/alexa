import type { SerializedMessage } from '../../core/serializer.js';
import { aiService } from './index.js';
import { takeoverManager } from './takeover.js';
import { logger } from '../../utils/logger.js';

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
      return;
    }

    const combinedPrompt = session.messages.join('\n');
    logger.info(
      `[Debouncer] Processing ${session.messages.length} aggregated message(s) from ${userId}`
    );

    try {
      const response = await aiService.generateResponse(combinedPrompt, {
        sessionId: userId,
      });

      if (response) {
        await session.lastMessage.reply(response);
      }
    } catch (error) {
      logger.error({ error, userId }, 'Error generating AI response for debounced messages');
    }
  }

  /**
   * Cancels any pending debounced messages for a user (e.g. if a command is executed)
   */
  cancel(userId: string): void {
    const session = this.buffers.get(userId);
    if (session) {
      clearTimeout(session.timer);
      this.buffers.delete(userId);
    }
  }
}

export const messageDebouncer = new MessageDebouncer(2000);
