import type OpenAI from 'openai';
import os from 'os';
import { takeoverManager } from './takeover.js';
import { dispatchWebhook } from '../../utils/webhook.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { alertService } from '../alerts/index.js';
import { localStore } from '../../core/store/localStore.js';

export interface ToolExecutionContext {
  sessionId?: string;
  senderNumber?: string;
  senderName?: string;
}

export const aiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current local date, day of week, and time in Indonesia (WIB, UTC+7).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_human_handover',
      description:
        'Call this function when the user explicitly requests to speak with a human agent, admin, or customer service representative.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Brief summary of what the user needs help with from a human agent.',
          },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_system_status',
      description: 'Get operational status, bot identity, and system uptime.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_business_data',
      description:
        'Jalankan kueri SQL SELECT baca-saja ke database lokal bisnis untuk mengambil data transaksi kasir, stok produk, riwayat pelanggan, atau analitik operasional secara dinamis. Gunakan schema tabel yang tersedia di sistem prompt.',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description:
              'Kueri SQL SELECT murni (hanya baca). Contoh: "SELECT cashier_name, SUM(total_amount) as total FROM pos_transactions WHERE created_at >= date(\'now\') GROUP BY cashier_name"',
          },
          purpose: {
            type: 'string',
            description: 'Tujuan analitik kueri ini dibuat (untuk logging audit internal).',
          },
        },
        required: ['sql'],
      },
    },
  },
];

/**
 * Executes a tool function called by the AI model
 */
export async function executeTool(
  toolName: string,
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<string> {
  logger.info({ toolName, args }, '[AI Tool Call] Executing tool function');

  switch (toolName) {
    case 'get_current_time': {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };
      const formatted = new Intl.DateTimeFormat('id-ID', options).format(now);
      return JSON.stringify({
        timezone: 'WIB (UTC+7)',
        currentTime: formatted,
      });
    }

    case 'request_human_handover': {
      const targetNumber = context.senderNumber || context.sessionId || 'unknown';
      const reason = args.reason || 'Customer requested human assistance';

      // Mute AI auto-reply for 60 minutes
      if (targetNumber !== 'unknown') {
        takeoverManager.mute(targetNumber, 60, reason, context.senderName);
      }

      // Dispatch webhook event to notify external CRM or notification system
      dispatchWebhook('support.requested', {
        senderNumber: targetNumber,
        senderName: context.senderName,
        reason,
        timestamp: Math.floor(Date.now() / 1000),
      }).catch(() => {});

      logger.warn(`[Handover] Human agent requested by ${targetNumber} (${context.senderName || 'Unknown'}). Reason: ${reason}`);

      // Dispatch real-time WhatsApp alert to business owners
      const timeStr = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      const alertText = [
        `[Eskalasi Admin Diperlukan]`,
        `Pelanggan: +${targetNumber} (${context.senderName || 'Pelanggan'})`,
        `Waktu: ${timeStr} WIB`,
        `Pemicu: Asisten AI (Intent Detection)`,
        `Alasan: "${reason}"`,
      ].join('\n');

      alertService.notifyOwners(alertText).catch((err) => {
        logger.error({ err }, '[AlertService] Failed to notify owners on AI handover');
      });

      return JSON.stringify({
        status: 'success',
        message:
          'Permintaan telah diteruskan ke admin/tim support kami. AI auto-reply telah dinonaktifkan sementara agar tim kami dapat merespons secara langsung.',
      });
    }

    case 'get_system_status': {
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);

      return JSON.stringify({
        botName: config.BOT_NAME,
        status: 'operational',
        uptime: `${hours}h ${minutes}m`,
        platform: `${os.type()} ${os.arch()}`,
        nodeVersion: process.version,
      });
    }

    case 'query_business_data': {
      const sql = String(args.sql || '').trim();
      const purpose = String(args.purpose || 'business_analytics');
      if (!sql) {
        return JSON.stringify({ success: false, error: 'SQL query cannot be empty' });
      }

      logger.info({ purpose, sql }, '[AI Query Business Data] Executing local query');
      try {
        const rows = localStore.executeSafeQuery(sql);
        return JSON.stringify({
          success: true,
          count: rows.length,
          data: rows,
        });
      } catch (err: unknown) {
        logger.warn({ err, sql }, '[AI Query Business Data] Query failed');
        return JSON.stringify({
          success: false,
          error: (err as Error).message || 'Gagal mengeksekusi query database lokal',
        });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool function: ${toolName}` });
  }
}
