import PQueue from 'p-queue';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class MessageQueueManager {
  private queue: PQueue;
  private delayMs: number;
  private pausedByConnection = false;

  constructor(delayMs: number = config.MESSAGE_DELAY_MS) {
    this.delayMs = delayMs;
    // Concurrency 1 ensures messages are sent sequentially with safe anti-ban pacing
    this.queue = new PQueue({ concurrency: 1 });
  }

  /**
   * Adds an automated send task to the queue with human-like jitter delay and retry guard
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return this.queue.add(async () => {
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          const result = await task();

          // Add human-like random jitter (base delay + 0 to 1000ms)
          const jitter = Math.floor(Math.random() * 1000);
          const totalDelay = this.delayMs + jitter;

          logger.debug(`Queue: Waiting ${totalDelay}ms before next message to protect account...`);
          await new Promise((resolve) => setTimeout(resolve, totalDelay));

          return result;
        } catch (err: unknown) {
          const errorMessage = (err as Error)?.message || String(err);
          const isNetworkError =
            errorMessage.includes('timed out') ||
            errorMessage.includes('Connection Closed') ||
            errorMessage.includes('rate-overlimit') ||
            errorMessage.includes('Socket');

          if (attempts < maxAttempts && isNetworkError) {
            logger.warn(
              { err, attempt: attempts },
              '[Queue] Transient error during message send. Retrying in 2000ms...'
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
          }

          logger.error({ err, attempts }, '[Queue] Error during queued message execution');
          throw err;
        }
      }

      throw new Error('Queue task failed after maximum retries');
    }) as Promise<T>;
  }

  /**
   * Circuit Breaker: Automatically pauses queue when WhatsApp disconnects
   */
  pauseForConnection(): void {
    if (!this.queue.isPaused) {
      this.pausedByConnection = true;
      this.queue.pause();
      logger.warn('[Queue Circuit Breaker] WhatsApp disconnected. Queue paused to prevent message failures.');
    }
  }

  /**
   * Circuit Breaker: Resumes queue when WhatsApp reconnects
   */
  resumeForConnection(): void {
    if (this.pausedByConnection) {
      this.pausedByConnection = false;
      this.queue.start();
      logger.info('[Queue Circuit Breaker] WhatsApp reconnected. Queue processing resumed.');
    }
  }

  /**
   * Manual pause
   */
  pause(): void {
    this.queue.pause();
    logger.info('[Queue] Manually paused.');
  }

  /**
   * Manual resume
   */
  resume(): void {
    this.pausedByConnection = false;
    this.queue.start();
    logger.info('[Queue] Manually resumed.');
  }

  getStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused,
      pausedByConnection: this.pausedByConnection,
      delayMs: this.delayMs,
    };
  }

  setDelay(delayMs: number): void {
    this.delayMs = delayMs;
  }

  getDelay(): number {
    return this.delayMs;
  }

  clear(): void {
    this.queue.clear();
    logger.info('[Queue] Queue cleared.');
  }
}

export const messageQueue = new MessageQueueManager();
