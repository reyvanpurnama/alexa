import { waClient } from '../../core/whatsapp.js';
import { parseSpintax } from '../../utils/spintax.js';
import { formatToWhatsAppJid, formatPhoneNumberForPairing } from '../../utils/jid.js';
import { dispatchWebhook } from '../../utils/webhook.js';
import { logger } from '../../utils/logger.js';

export type BroadcastStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface BroadcastRecipient {
  phone: string;
  name?: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: number;
  error?: string;
  messageText?: string;
}

export interface BroadcastConfig {
  minDelayMs: number;
  maxDelayMs: number;
  batchSize: number;
  batchDelayMs: number;
}

export interface BroadcastJob {
  id: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  status: BroadcastStatus;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  currentIndex: number;
  template: string;
  media?: {
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    caption?: string;
    fileName?: string;
  };
  config: BroadcastConfig;
  recipients: BroadcastRecipient[];
}

export interface StartBroadcastParams {
  targets: Array<string | { phone: string; name?: string }>;
  template: string;
  media?: {
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    caption?: string;
    fileName?: string;
  };
  config?: Partial<BroadcastConfig>;
}

export class BroadcastManager {
  private currentJob: BroadcastJob | null = null;
  private history: BroadcastJob[] = [];
  private isProcessing = false;

  private defaultMinDelay = 4000;
  private defaultMaxDelay = 8000;
  private defaultBatchSize = 15;
  private defaultBatchDelay = 25000;

  /**
   * Starts a new bulk broadcast job with anti-ban pacing and Spintax
   */
  async startBroadcast(params: StartBroadcastParams): Promise<BroadcastJob> {
    if (!waClient.isConnected()) {
      throw new Error('Cannot start broadcast: WhatsApp is not connected.');
    }

    if (this.currentJob && (this.currentJob.status === 'running' || this.currentJob.status === 'paused')) {
      throw new Error(`A broadcast job (${this.currentJob.id}) is already ${this.currentJob.status}. Please wait or cancel it first.`);
    }

    if (!params.targets || params.targets.length === 0) {
      throw new Error('Broadcast targets list cannot be empty.');
    }

    if (!params.template || params.template.trim().length === 0) {
      throw new Error('Broadcast message template cannot be empty.');
    }

    // Deduplicate and normalize recipients
    const uniqueRecipients = new Map<string, BroadcastRecipient>();

    for (const item of params.targets) {
      const rawPhone = typeof item === 'string' ? item : item.phone;
      const rawName = typeof item === 'string' ? undefined : item.name;

      const cleanPhone = formatPhoneNumberForPairing(rawPhone);
      if (cleanPhone.length >= 8) {
        if (!uniqueRecipients.has(cleanPhone)) {
          uniqueRecipients.set(cleanPhone, {
            phone: cleanPhone,
            name: rawName,
            status: 'pending',
          });
        }
      }
    }

    const recipients = Array.from(uniqueRecipients.values());
    if (recipients.length === 0) {
      throw new Error('No valid phone numbers found in targets list.');
    }

    const config: BroadcastConfig = {
      minDelayMs: Math.max(1000, params.config?.minDelayMs ?? this.defaultMinDelay),
      maxDelayMs: Math.max(2000, params.config?.maxDelayMs ?? this.defaultMaxDelay),
      batchSize: Math.max(1, params.config?.batchSize ?? this.defaultBatchSize),
      batchDelayMs: Math.max(5000, params.config?.batchDelayMs ?? this.defaultBatchDelay),
    };

    if (config.minDelayMs > config.maxDelayMs) {
      config.maxDelayMs = config.minDelayMs + 2000;
    }

    const jobId = `bc_${Date.now()}`;
    const job: BroadcastJob = {
      id: jobId,
      createdAt: Date.now(),
      status: 'running',
      totalTargets: recipients.length,
      sentCount: 0,
      failedCount: 0,
      currentIndex: 0,
      template: params.template,
      media: params.media,
      config,
      recipients,
    };

    this.currentJob = job;
    logger.info(`[Broadcast] Created job ${jobId} with ${recipients.length} target recipients.`);

    // Run asynchronous processing in the background (non-blocking)
    this.processJob(job).catch((err) => {
      logger.error({ err, jobId }, '[Broadcast] Unhandled error during broadcast processing');
    });

    dispatchWebhook('broadcast.started', {
      jobId,
      totalTargets: recipients.length,
      timestamp: Math.floor(Date.now() / 1000),
    }).catch(() => {});

    return job;
  }

  /**
   * Safe asynchronous execution loop with Spintax, random jitter, and batch breaks
   */
  private async processJob(job: BroadcastJob): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    job.startedAt = Date.now();

    try {
      while (job.currentIndex < job.totalTargets) {
        // Check if cancelled
        if (job.status === 'cancelled') {
          logger.info(`[Broadcast] Job ${job.id} was cancelled by user.`);
          break;
        }

        // Check if paused: wait in loop
        if (job.status === 'paused') {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        const recipient = job.recipients[job.currentIndex];
        if (!recipient) break;

        // Generate personalized text using Spintax and dynamic variables
        const personalizedText = parseSpintax(job.template, {
          name: recipient.name,
          nama: recipient.name,
          phone: recipient.phone,
          nomor: recipient.phone,
        });

        recipient.messageText = personalizedText;

        try {
          if (job.media) {
            await waClient.sendMedia(
              recipient.phone,
              {
                type: job.media.type,
                url: job.media.url,
                caption: personalizedText,
                fileName: job.media.fileName,
              },
              { queued: false }
            );
          } else {
            await waClient.sendText(recipient.phone, personalizedText, { queued: false });
          }

          recipient.status = 'sent';
          recipient.sentAt = Date.now();
          job.sentCount++;
          logger.info(
            `[Broadcast] (${job.currentIndex + 1}/${job.totalTargets}) Sent to +${recipient.phone}`
          );
        } catch (err: unknown) {
          recipient.status = 'failed';
          recipient.error = (err as Error).message || 'Send error';
          job.failedCount++;
          logger.warn(
            { err, phone: recipient.phone },
            `[Broadcast] (${job.currentIndex + 1}/${job.totalTargets}) Failed to send to +${recipient.phone}`
          );
        }

        job.currentIndex++;

        // Dispatch progress webhook periodically (every 5 messages or when done)
        if (job.currentIndex % 5 === 0 || job.currentIndex === job.totalTargets) {
          dispatchWebhook('broadcast.progress', {
            jobId: job.id,
            totalTargets: job.totalTargets,
            sentCount: job.sentCount,
            failedCount: job.failedCount,
            progressPercent: Math.round((job.currentIndex / job.totalTargets) * 100),
          }).catch(() => {});
        }

        // If there are more recipients, apply human-like delay and check batch resting
        if (job.currentIndex < job.totalTargets && job.status === 'running') {
          // Check batch limit for rest interval
          if (job.currentIndex % job.config.batchSize === 0) {
            logger.info(
              `[Broadcast] Batch limit reached (${job.currentIndex}/${job.totalTargets}). Resting for ${
                job.config.batchDelayMs / 1000
              }s to prevent account flags...`
            );
            await new Promise((resolve) => setTimeout(resolve, job.config.batchDelayMs));
          } else {
            // Random delay between minDelay and maxDelay
            const range = job.config.maxDelayMs - job.config.minDelayMs;
            const jitterDelay = job.config.minDelayMs + Math.floor(Math.random() * range);
            logger.debug(`[Broadcast] Pacing delay: ${jitterDelay}ms`);
            await new Promise((resolve) => setTimeout(resolve, jitterDelay));
          }
        }
      }

      if (job.status !== 'cancelled') {
        job.status = 'completed';
      }

      job.completedAt = Date.now();
      logger.info(
        `[Broadcast] Job ${job.id} finished with status "${job.status}". Sent: ${job.sentCount}, Failed: ${job.failedCount}.`
      );

      dispatchWebhook('broadcast.completed', {
        jobId: job.id,
        status: job.status,
        totalTargets: job.totalTargets,
        sentCount: job.sentCount,
        failedCount: job.failedCount,
        durationSeconds: Math.floor(((job.completedAt || Date.now()) - (job.startedAt || job.createdAt)) / 1000),
      }).catch(() => {});
    } finally {
      this.isProcessing = false;
      this.history.unshift(job);
      // Cap in-memory history to last 10 jobs
      if (this.history.length > 10) {
        this.history.pop();
      }
    }
  }

  /**
   * Pauses the active broadcast
   */
  pauseBroadcast(): boolean {
    if (this.currentJob && this.currentJob.status === 'running') {
      this.currentJob.status = 'paused';
      logger.info(`[Broadcast] Paused job ${this.currentJob.id}`);
      return true;
    }
    return false;
  }

  /**
   * Resumes the paused broadcast
   */
  resumeBroadcast(): boolean {
    if (this.currentJob && this.currentJob.status === 'paused') {
      this.currentJob.status = 'running';
      logger.info(`[Broadcast] Resumed job ${this.currentJob.id}`);
      return true;
    }
    return false;
  }

  /**
   * Cancels the active broadcast
   */
  cancelBroadcast(): boolean {
    if (this.currentJob && (this.currentJob.status === 'running' || this.currentJob.status === 'paused')) {
      this.currentJob.status = 'cancelled';
      logger.info(`[Broadcast] Cancelled job ${this.currentJob.id}`);
      return true;
    }
    return false;
  }

  /**
   * Retrieves active job and broadcast history
   */
  getStatus(): {
    currentJob: BroadcastJob | null;
    history: BroadcastJob[];
  } {
    return {
      currentJob: this.currentJob,
      history: this.history,
    };
  }
}

export const broadcastManager = new BroadcastManager();
