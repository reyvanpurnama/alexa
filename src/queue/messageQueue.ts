import PQueue from 'p-queue';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class MessageQueueManager {
  private queue: PQueue;
  private delayMs: number;

  constructor(delayMs: number = config.MESSAGE_DELAY_MS) {
    this.delayMs = delayMs;
    // Concurrency 1 ensures messages are sent sequentially
    this.queue = new PQueue({ concurrency: 1 });
  }

  /**
   * Adds an automated send task to the queue with human-like jitter delay
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return this.queue.add(async () => {
      try {
        const result = await task();

        // Add human-like random jitter (base delay + 0 to 1000ms)
        const jitter = Math.floor(Math.random() * 1000);
        const totalDelay = this.delayMs + jitter;
        
        logger.debug(`Queue: Waiting ${totalDelay}ms before next message to protect account...`);
        await new Promise((resolve) => setTimeout(resolve, totalDelay));

        return result;
      } catch (err) {
        logger.error({ err }, 'Error during queued message execution');
        throw err;
      }
    }) as Promise<T>;
  }

  getStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused,
    };
  }

  setDelay(delayMs: number): void {
    this.delayMs = delayMs;
  }

  getDelay(): number {
    return this.delayMs;
  }

  clear() {
    this.queue.clear();
  }
}

export const messageQueue = new MessageQueueManager();
