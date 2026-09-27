import type OpenAI from 'openai';
import os from 'os';
import { takeoverManager } from './takeover.js';
import { dispatchWebhook } from '../../utils/webhook.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { alertService } from '../alerts/index.js';

export interface ToolExecutionContext {
  sessionId?: string;
  senderNumber?: string;
}

const LARAVEL_API_URL = process.env.LARAVEL_API_URL || 'https://bermadaniumbandung.id';
const BOT_API_KEY = process.env.API_KEY || config.API_KEY || 'wa_secret_token_12345';

/**
 * Helper to call Laravel internal Bot API with x-api-key authentication
 */
async function fetchFromLaravel(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(path, LARAVEL_API_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': BOT_API_KEY,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      logger.warn({ status: res.status, errorText, path }, '[Laravel API] Request failed');
      return {
        success: false,
        status: res.status,
        message: `Gagal mengakses data koperasi (HTTP ${res.status}).`,
      };
    }

    return await res.json();
  } catch (err: any) {
    logger.error({ err, path }, '[Laravel API] Connection error');
    return {
      success: false,
      message: 'Tidak dapat terhubung ke server database Koperasi Bermadani.',
    };
  }
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
      name: 'check_product_stock',
      description:
        'Cek ketersediaan stok, harga jual aktif, satuan, dan kategori produk real-time dari database toko Koperasi Bermadani. Panggil tool ini setiap kali pelanggan atau supplier menanyakan stok produk (misal: "Ada Indomie?", "Berapa harga kopi?", "Cek stok roti"). Jangan pernah mengarang stok atau harga.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Nama produk atau kata kunci pencarian (misal: "Indomie", "Aqua", "Roti", "Susu").',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cooperative_info',
      description:
        'Mengambil informasi profil resmi koperasi, jam operasional kasir/toko real-time, rekening bank resmi untuk transfer, info pembayaran QRIS, alamat kampus UMB, dan kebijakan batas omzet konsinyasi. Panggil tool ini saat ada pertanyaan jam buka/tutup, transfer pembayaran, rekening, alamat, atau aturan titipan.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: ['operating_hours', 'bank_accounts', 'address', 'consignment_rules', 'all'],
            description: 'Topik informasi yang ingin diambil.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_supplier_consignment_status',
      description:
        'Mengambil rekapitulasi penjualan produk titipan hari ini, rincian barang terjual, sisa produk, dan saldo bagi hasil yang sudah siap diambil di kasir untuk supplier penanya. Otomatis menggunakan nomor WhatsApp penanya untuk menjaga privasi. Panggil tool ini saat mitra supplier menanyakan hasil penjualan, rekap titipan, atau konfirmasi apakah bagi hasil sudah bisa diambil.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_member_status',
      description:
        'Verifikasi keaktifan anggota koperasi berdasarkan nomor anggota atau nomor WhatsApp penanya. Panggil tool ini saat ada yang menanyakan status keanggotaan Koperasi Bermadani.',
      parameters: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Nomor anggota (misal: "MBR-xxx") atau nomor HP penanya.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_human_handover',
      description:
        'Call this function when the user explicitly requests to speak with a human agent, admin, or customer service representative, or when there is a serious complaint/dispute.',
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

    case 'check_product_stock': {
      const query = String(args.query || '').trim();
      const result = await fetchFromLaravel('/api/bot/products', { q: query });
      return JSON.stringify(result);
    }

    case 'get_cooperative_info': {
      const result = await fetchFromLaravel('/api/bot/settings');
      return JSON.stringify(result);
    }

    case 'get_supplier_consignment_status': {
      const senderPhone = context.senderNumber || context.sessionId || '';
      if (!senderPhone || senderPhone === 'unknown') {
        return JSON.stringify({
          success: false,
          found: false,
          message: 'Nomor WhatsApp pengirim tidak terdeteksi untuk memverifikasi data supplier.',
        });
      }
      const result = await fetchFromLaravel('/api/bot/supplier-summary', { phone: senderPhone });
      return JSON.stringify(result);
    }

    case 'check_member_status': {
      const identifier = String(args.identifier || context.senderNumber || '').trim();
      if (!identifier) {
        return JSON.stringify({
          success: false,
          found: false,
          message: 'Mohon cantumkan nomor anggota atau nomor WhatsApp yang ingin dicek.',
        });
      }
      const result = await fetchFromLaravel('/api/bot/member-status', { identifier });
      return JSON.stringify(result);
    }

    case 'request_human_handover': {
      const targetNumber = context.senderNumber || context.sessionId || 'unknown';
      const reason = args.reason || 'Customer requested human assistance';

      // Mute AI auto-reply for 60 minutes
      if (targetNumber !== 'unknown') {
        takeoverManager.mute(targetNumber, 60, reason);
      }

      // Dispatch webhook event to notify external CRM or notification system
      dispatchWebhook('support.requested', {
        senderNumber: targetNumber,
        reason,
        timestamp: Math.floor(Date.now() / 1000),
      }).catch(() => {});

      logger.warn(`[Handover] Human agent requested by ${targetNumber}. Reason: ${reason}`);

      // Dispatch real-time WhatsApp alert to business owners
      const timeStr = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      const alertText = [
        `[Eskalasi Admin Diperlukan]`,
        `Pelanggan: +${targetNumber}`,
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

    default:
      return JSON.stringify({ error: `Unknown tool function: ${toolName}` });
  }
}
