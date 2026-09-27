import { generateMessageIDV2 } from '@whiskeysockets/baileys';
import { dispatchWebhook } from '../../utils/webhook.js';
import { logger } from '../../utils/logger.js';

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface TrackedMessage {
  id: string; // WhatsApp key.id
  referenceId?: string; // Client's external reference ID
  to: string;
  type: 'text' | 'media' | 'broadcast';
  status: DeliveryStatus;
  error?: string;
  queuedAt: number;
  sentAt?: number;
  deliveredAt?: number;
  readAt?: number;
  failedAt?: number;
}

export interface RegisterMessageParams {
  messageId?: string;
  referenceId?: string;
  to: string;
  type: 'text' | 'media' | 'broadcast';
  initialStatus?: DeliveryStatus;
}

export class MessageTracker {
  // In-memory LRU-like store of the last 5,000 outbound messages
  private messages = new Map<string, TrackedMessage>();
  private referenceIndex = new Map<string, string>(); // referenceId -> messageId
  private readonly maxEntries = 5000;

  /**
   * Generates a valid WhatsApp message ID upfront for queue tracing
   */
  generateId(userId?: string): string {
    try {
      return generateMessageIDV2(userId);
    } catch {
      return `ALX${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    }
  }

  /**
   * Registers a message when it enters the queue or is sent
   */
  register(params: RegisterMessageParams): TrackedMessage {
    const id = params.messageId || this.generateId();
    const status = params.initialStatus || 'queued';
    const now = Date.now();

    const record: TrackedMessage = {
      id,
      referenceId: params.referenceId?.trim() || undefined,
      to: params.to,
      type: params.type,
      status,
      queuedAt: now,
      sentAt: status === 'sent' ? now : undefined,
    };

    // Maintain max entries limit
    if (this.messages.size >= this.maxEntries) {
      const oldestKey = this.messages.keys().next().value;
      if (oldestKey) {
        const oldMsg = this.messages.get(oldestKey);
        if (oldMsg?.referenceId) {
          this.referenceIndex.delete(oldMsg.referenceId);
        }
        this.messages.delete(oldestKey);
      }
    }

    this.messages.set(id, record);
    if (record.referenceId) {
      this.referenceIndex.set(record.referenceId, id);
    }

    logger.debug(`[MessageTracker] Registered message ${id} (${status}) to ${params.to}`);
    return record;
  }

  /**
   * Updates delivery status for a message (from Baileys event or queue worker)
   */
  updateStatus(
    messageId: string,
    status: DeliveryStatus,
    error?: string
  ): TrackedMessage | null {
    const record = this.messages.get(messageId);
    if (!record) {
      logger.debug(`[MessageTracker] Update ignored for untracked message: ${messageId}`);
      return null;
    }

    // Don't downgrade status (e.g. from delivered back to sent)
    const statusPriority: Record<DeliveryStatus, number> = {
      queued: 1,
      sent: 2,
      delivered: 3,
      read: 4,
      failed: 5,
    };

    if (
      record.status !== 'failed' &&
      status !== 'failed' &&
      statusPriority[record.status] >= statusPriority[status]
    ) {
      return record;
    }

    const now = Date.now();
    record.status = status;

    if (status === 'sent' && !record.sentAt) {
      record.sentAt = now;
    } else if (status === 'delivered') {
      record.deliveredAt = now;
    } else if (status === 'read') {
      record.readAt = now;
    } else if (status === 'failed') {
      record.failedAt = now;
      record.error = error || record.error || 'Message delivery failed';
    }

    logger.info(
      `[MessageTracker] Status updated for ${messageId} -> ${status.toUpperCase()} (to: ${record.to})`
    );

    // Dispatch webhook to client callback URL
    dispatchWebhook('message.status', {
      messageId: record.id,
      referenceId: record.referenceId,
      to: record.to,
      status: record.status,
      type: record.type,
      error: record.error,
      timestamp: Math.floor(now / 1000),
      timestamps: {
        queuedAt: record.queuedAt,
        sentAt: record.sentAt,
        deliveredAt: record.deliveredAt,
        readAt: record.readAt,
        failedAt: record.failedAt,
      },
    }).catch(() => {});

    return record;
  }

  /**
   * Retrieve message record by WhatsApp message ID
   */
  getById(messageId: string): TrackedMessage | null {
    return this.messages.get(messageId) || null;
  }

  /**
   * Retrieve message record by external client reference ID
   */
  getByReferenceId(referenceId: string): TrackedMessage | null {
    const id = this.referenceIndex.get(referenceId);
    if (!id) return null;
    return this.messages.get(id) || null;
  }

  /**
   * Retrieve recent tracked messages with optional status filter
   */
  getRecent(limit: number = 50, filterStatus?: DeliveryStatus): TrackedMessage[] {
    const all = Array.from(this.messages.values());
    const filtered = filterStatus ? all.filter((m) => m.status === filterStatus) : all;
    return filtered.slice(-limit).reverse();
  }

  /**
   * Aggregated statistics of tracked messages
   */
  getStats(): {
    totalTracked: number;
    queued: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  } {
    let queued = 0;
    let sent = 0;
    let delivered = 0;
    let read = 0;
    let failed = 0;

    for (const msg of this.messages.values()) {
      switch (msg.status) {
        case 'queued':
          queued++;
          break;
        case 'sent':
          sent++;
          break;
        case 'delivered':
          delivered++;
          break;
        case 'read':
          read++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }

    return {
      totalTracked: this.messages.size,
      queued,
      sent,
      delivered,
      read,
      failed,
    };
  }

  /**
   * Clear all tracked messages
   */
  clear(): void {
    this.messages.clear();
    this.referenceIndex.clear();
  }
}

export const messageTracker = new MessageTracker();
