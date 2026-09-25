import type OpenAI from 'openai';
import os from 'os';
import { takeoverManager } from './takeover.js';
import { dispatchWebhook } from '../../utils/webhook.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export interface ToolExecutionContext {
  sessionId?: string;
  senderNumber?: string;
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
        takeoverManager.mute(targetNumber, 60, reason);
      }

      // Dispatch webhook event to notify external CRM or notification system
      dispatchWebhook('support.requested', {
        senderNumber: targetNumber,
        reason,
        timestamp: Math.floor(Date.now() / 1000),
      }).catch(() => {});

      logger.warn(`[Handover] Human agent requested by ${targetNumber}. Reason: ${reason}`);

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
