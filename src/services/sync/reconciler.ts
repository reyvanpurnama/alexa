import { config } from '../../config/index.js';
import { localStore } from '../../core/store/localStore.js';
import { logger } from '../../utils/logger.js';

export interface ReconcileResponse {
  success: boolean;
  currentTimestamp?: number;
  events?: {
    table: string;
    action?: 'upsert' | 'delete';
    primaryKey?: string;
    data?: Record<string, any>;
    id?: any;
  }[];
}

export class SyncReconciler {
  private timer: NodeJS.Timeout | null = null;
  private lastTimestamp = 0;
  private isRunning = false;

  /**
   * Starts the background catch-up worker if configured
   */
  start(): void {
    if (!config.SYNC_RECONCILE_ENABLED || !config.SYNC_RECONCILE_URL) {
      logger.debug('[SyncReconciler] Catch-up reconciler is disabled (configure SYNC_RECONCILE_URL to enable)');
      return;
    }

    const intervalMs = Math.max(1, config.SYNC_RECONCILE_INTERVAL_MIN) * 60 * 1000;
    logger.info(
      { url: config.SYNC_RECONCILE_URL, intervalMinutes: config.SYNC_RECONCILE_INTERVAL_MIN },
      '[SyncReconciler] Incremental catch-up worker started'
    );

    // Initial check after 10s delay to allow other services to boot
    setTimeout(() => {
      this.reconcile().catch(() => {});
    }, 10000);

    this.timer = setInterval(() => {
      this.reconcile().catch(() => {});
    }, intervalMs);
  }

  /**
   * Stops the background worker
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Executes a reconciliation request against the external ERP/POS backend
   */
  async reconcile(): Promise<{ processed: number; success: boolean }> {
    if (this.isRunning || !config.SYNC_RECONCILE_URL) {
      return { processed: 0, success: false };
    }

    this.isRunning = true;
    try {
      const url = new URL(config.SYNC_RECONCILE_URL);
      if (this.lastTimestamp > 0) {
        url.searchParams.set('since', String(this.lastTimestamp));
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Alexa-Sync-Reconciler/1.0',
        Accept: 'application/json',
      };

      if (config.API_KEY) {
        headers['x-api-key'] = config.API_KEY;
      }
      if (config.WEBHOOK_SECRET) {
        headers['x-webhook-secret'] = config.WEBHOOK_SECRET;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        logger.warn(
          { status: res.status, url: config.SYNC_RECONCILE_URL },
          '[SyncReconciler] Catch-up backend returned non-2xx response'
        );
        return { processed: 0, success: false };
      }

      const data = (await res.json()) as ReconcileResponse;
      const events = data.events || [];

      if (events.length > 0) {
        let count = 0;
        for (const ev of events) {
          if (!ev.table) continue;
          const pk = ev.primaryKey || 'id';

          if (ev.action === 'delete') {
            const targetId = ev.id ?? ev.data?.[pk];
            if (targetId !== undefined && targetId !== null) {
              localStore.deleteRecord(ev.table, targetId, pk);
              count++;
            }
          } else if (ev.data) {
            localStore.upsertRecord(ev.table, ev.data, pk);
            count++;
          }
        }

        logger.info(
          { count, total: events.length },
          '[SyncReconciler] Successfully caught up and synced data from backend'
        );
      }

      this.lastTimestamp = data.currentTimestamp || Math.floor(Date.now() / 1000);
      return { processed: events.length, success: true };
    } catch (err: unknown) {
      logger.debug(
        { error: (err as Error).message },
        '[SyncReconciler] Catch-up attempt skipped (network or timeout)'
      );
      return { processed: 0, success: false };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Returns current worker status
   */
  getStatus(): { enabled: boolean; lastTimestamp: number; intervalMin: number } {
    return {
      enabled: Boolean(config.SYNC_RECONCILE_ENABLED && config.SYNC_RECONCILE_URL),
      lastTimestamp: this.lastTimestamp,
      intervalMin: config.SYNC_RECONCILE_INTERVAL_MIN,
    };
  }
}

export const syncReconciler = new SyncReconciler();
