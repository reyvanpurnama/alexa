import { config } from '../config/index.js';
import { logger } from './logger.js';

export interface WebhookPayload {
  event: 'message.received' | string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Dispatches an event to the configured external WEBHOOK_URL
 * Non-blocking, fails gracefully without crashing the core engine.
 */
export async function dispatchWebhook(event: string, data: Record<string, unknown>): Promise<void> {
  const webhookUrl = config.WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload: WebhookPayload = {
    event,
    timestamp: Math.floor(Date.now() / 1000),
    data,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Alexa-WA-Gateway/1.0',
  };

  if (config.WEBHOOK_SECRET) {
    headers['x-webhook-secret'] = config.WEBHOOK_SECRET;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.debug(
        { status: response.status, url: webhookUrl },
        'Webhook delivery returned non-2xx status'
      );
    }
  } catch (error) {
    logger.debug(
      { error: (error as Error).message, url: webhookUrl },
      'Failed to forward webhook event'
    );
  }
}
