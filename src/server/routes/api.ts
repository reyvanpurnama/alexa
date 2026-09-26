import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { waClient } from '../../core/whatsapp.js';
import { messageQueue } from '../../queue/messageQueue.js';
import { config } from '../../config/index.js';
import { knowledgeManager, aiService } from '../../services/ai/index.js';
import { alertService } from '../../services/alerts/index.js';
import { broadcastManager } from '../../services/broadcast/index.js';
import { previewSpintax } from '../../utils/spintax.js';

const sendMessageSchema = z.object({
  to: z.string().min(5, 'Target phone number or JID is required'),
  message: z.string().min(1, 'Message text cannot be empty'),
  queued: z.boolean().optional().default(true),
});

const sendMediaSchema = z.object({
  to: z.string().min(5, 'Target phone number or JID is required'),
  type: z.enum(['image', 'video', 'audio', 'document']),
  url: z.string().url('A valid media URL is required'),
  caption: z.string().optional(),
  fileName: z.string().optional(),
  mimetype: z.string().optional(),
  queued: z.boolean().optional().default(true),
});

const pairingSchema = z.object({
  phoneNumber: z.string().min(8, 'Phone number must be at least 8 digits'),
  sessionName: z.string().optional(),
});

const checkNumberSchema = z.object({
  phoneNumber: z.string().min(5, 'Phone number is required'),
});

const startBroadcastSchema = z.object({
  targets: z
    .array(
      z.union([
        z.string().min(5),
        z.object({
          phone: z.string().min(5),
          name: z.string().optional(),
        }),
      ])
    )
    .min(1, 'Target recipients cannot be empty'),
  message: z.string().min(1, 'Message template cannot be empty'),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
  fileName: z.string().optional(),
  minDelayMs: z.number().int().min(1000).max(60000).optional(),
  maxDelayMs: z.number().int().min(1000).max(120000).optional(),
  batchSize: z.number().int().min(1).max(100).optional(),
  batchDelayMs: z.number().int().min(5000).max(300000).optional(),
});

const previewSpintaxSchema = z.object({
  template: z.string().min(1, 'Template cannot be empty'),
  count: z.number().int().min(1).max(10).optional().default(3),
  variables: z.record(z.string(), z.string()).optional(),
});

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Authentication hook for protected API routes
  fastify.addHook('preHandler', async (request, reply) => {
    // Exclude GET status, root, and swagger docs
    const path = request.routeOptions?.url || request.url;
    if (path === '/api/status' || path === '/' || path.startsWith('/docs')) {
      return; // Public endpoints
    }

    const apiKey =
      (request.headers['x-api-key'] as string) ||
      (request.headers.authorization ? request.headers.authorization.replace('Bearer ', '') : null) ||
      (request.query as { apiKey?: string })?.apiKey;

    if (!apiKey || apiKey !== config.API_KEY) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized: Invalid or missing API Key. Pass "x-api-key" header.',
      });
    }
  });

  // GET /api/status
  fastify.get('/api/status', async (_req, reply) => {
    return reply.send({
      success: true,
      status: waClient.getStatus(),
      connected: waClient.isConnected(),
      user: waClient.user,
      queue: messageQueue.getStats(),
      pairingCode: waClient.getPairingCode(),
    });
  });

  // POST /api/pairing - Request Pairing Code for a phone number
  fastify.post('/api/pairing', async (request, reply) => {
    const parse = pairingSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload',
        details: parse.error.format(),
      });
    }

    try {
      const code = await waClient.requestPairing(parse.data.phoneNumber, parse.data.sessionName);
      return reply.send({
        success: true,
        message: 'Pairing code generated successfully. Enter this code in WhatsApp -> Linked Devices.',
        phoneNumber: parse.data.phoneNumber,
        sessionName: waClient.getActiveSessionName(),
        code,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to request pairing code',
      });
    }
  });

  // POST /api/session/logout - Disconnect active session and reset credentials for new pairing
  fastify.post('/api/session/logout', async (_request, reply) => {
    try {
      await waClient.logout();
      return reply.send({
        success: true,
        message: 'Session disconnected and credentials cleared. Ready for new pairing or QR scan.',
        status: waClient.getStatus(),
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to logout session',
      });
    }
  });

  // GET /api/sessions - List all saved session profiles and active session
  fastify.get('/api/sessions', async (_request, reply) => {
    return reply.send({
      success: true,
      activeSession: waClient.getActiveSessionName(),
      sessions: waClient.listSessions(),
    });
  });

  // POST /api/sessions/switch - Hot-swap active session without deleting credentials
  fastify.post('/api/sessions/switch', async (request, reply) => {
    const parse = z
      .object({
        sessionName: z
          .string()
          .min(1, 'Session name is required')
          .regex(/^[a-zA-Z0-9_-]+$/, 'Session name must contain only letters, numbers, underscores, and hyphens'),
      })
      .safeParse(request.body);

    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid session name payload',
        details: parse.error.format(),
      });
    }

    try {
      const result = await waClient.switchSession(parse.data.sessionName);
      return reply.send({
        message: result.isNew
          ? `Switched to new session "${result.sessionName}". Ready for pairing via POST /api/pairing.`
          : `Switched to existing session "${result.sessionName}". Connecting...`,
        ...result,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to switch session',
      });
    }
  });

  // DELETE /api/sessions/:sessionName - Delete an inactive session profile from disk
  fastify.delete('/api/sessions/:sessionName', async (request, reply) => {
    const { sessionName } = request.params as { sessionName: string };

    try {
      const deleted = waClient.deleteSession(sessionName);
      if (deleted) {
        return reply.send({
          success: true,
          message: `Session "${sessionName}" deleted successfully.`,
        });
      } else {
        return reply.code(404).send({
          success: false,
          error: `Session "${sessionName}" not found.`,
        });
      }
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Failed to delete session',
      });
    }
  });

  // GET /api/knowledge - Inspect current active business knowledge context
  fastify.get('/api/knowledge', async (_request, reply) => {
    return reply.send({
      success: true,
      stats: knowledgeManager.getStats(),
      context: knowledgeManager.getKnowledgeContext(),
    });
  });

  // POST /api/knowledge/reload - Re-index knowledge base files from disk
  fastify.post('/api/knowledge/reload', async (_request, reply) => {
    knowledgeManager.reload();
    return reply.send({
      success: true,
      message: 'Knowledge base reloaded successfully.',
      stats: knowledgeManager.getStats(),
    });
  });

  // POST /api/ai/query - Test Grounded AI Query
  fastify.post('/api/ai/query', async (request, reply) => {
    const { prompt } = (request.body as { prompt?: string }) || {};
    if (!prompt || !prompt.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'Prompt query cannot be empty',
      });
    }

    try {
      const response = await aiService.generateResponse(prompt.trim());
      return reply.send({
        success: true,
        prompt: prompt.trim(),
        response,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to generate AI response',
      });
    }
  });

  // POST /api/check-number - Verify if phone number is registered on WhatsApp
  fastify.post('/api/check-number', async (request, reply) => {
    const parse = checkNumberSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload',
        details: parse.error.format(),
      });
    }

    if (!waClient.isConnected()) {
      return reply.code(503).send({
        success: false,
        error: 'WhatsApp is not connected. Current status: ' + waClient.getStatus(),
      });
    }

    try {
      const result = await waClient.checkNumber(parse.data.phoneNumber);
      return reply.send({
        success: true,
        phoneNumber: parse.data.phoneNumber,
        registered: result.registered,
        jid: result.jid,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to check phone number',
      });
    }
  });

  // POST /api/send-message - Send Text Message
  fastify.post('/api/send-message', async (request, reply) => {
    const parse = sendMessageSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload',
        details: parse.error.format(),
      });
    }

    if (!waClient.isConnected()) {
      return reply.code(503).send({
        success: false,
        error: 'WhatsApp is not connected. Current status: ' + waClient.getStatus(),
      });
    }

    try {
      const { to, message, queued } = parse.data;
      const result = await waClient.sendText(to, message, { queued });
      return reply.send({
        success: true,
        message: queued ? 'Message scheduled in anti-ban queue' : 'Message sent immediately',
        target: to,
        queueStatus: messageQueue.getStats(),
        result,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to send message',
      });
    }
  });

  // POST /api/send-media - Send Image/Doc/Video
  fastify.post('/api/send-media', async (request, reply) => {
    const parse = sendMediaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload',
        details: parse.error.format(),
      });
    }

    if (!waClient.isConnected()) {
      return reply.code(503).send({
        success: false,
        error: 'WhatsApp is not connected. Current status: ' + waClient.getStatus(),
      });
    }

    try {
      const { to, type, url, caption, fileName, mimetype, queued } = parse.data;
      const result = await waClient.sendMedia(
        to,
        { type, url, caption, fileName, mimetype },
        { queued }
      );

      return reply.send({
        success: true,
        message: queued ? 'Media scheduled in anti-ban queue' : 'Media sent immediately',
        target: to,
        type,
        queueStatus: messageQueue.getStats(),
        result,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to send media',
      });
    }
  });

  // POST /api/alerts/test - Test Owner Alerts Dispatch
  fastify.post('/api/alerts/test', async (request, reply) => {
    const body = (request.body as { message?: string }) || {};
    const timeStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const alertMessage =
      body.message ||
      `[Uji Coba Notifikasi Owner]\nSistem peringatan real-time Alexa beroperasi dengan normal.\nWaktu: ${timeStr} WIB`;

    try {
      await alertService.notifyOwners(alertMessage);
      return reply.send({
        success: true,
        message: 'Owner notification dispatched successfully',
        configuredOwners: config.OWNER_NUMBERS,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to dispatch owner notification',
      });
    }
  });

  // POST /api/broadcast - Start Bulk Broadcast
  fastify.post('/api/broadcast', async (request, reply) => {
    const parse = startBroadcastSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid broadcast payload',
        details: parse.error.format(),
      });
    }

    try {
      const {
        targets,
        message,
        mediaUrl,
        mediaType,
        fileName,
        minDelayMs,
        maxDelayMs,
        batchSize,
        batchDelayMs,
      } = parse.data;

      const media =
        mediaUrl && mediaType
          ? {
              url: mediaUrl,
              type: mediaType,
              fileName,
            }
          : undefined;

      const job = await broadcastManager.startBroadcast({
        targets,
        template: message,
        media,
        config: {
          minDelayMs,
          maxDelayMs,
          batchSize,
          batchDelayMs,
        },
      });

      return reply.send({
        success: true,
        message: 'Broadcast job started successfully',
        jobId: job.id,
        totalTargets: job.totalTargets,
        status: job.status,
        config: job.config,
      });
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Failed to start broadcast',
      });
    }
  });

  // GET /api/broadcast/status - Broadcast Progress & History
  fastify.get('/api/broadcast/status', async (_request, reply) => {
    const status = broadcastManager.getStatus();
    const current = status.currentJob;

    return reply.send({
      success: true,
      currentJob: current
        ? {
            id: current.id,
            status: current.status,
            totalTargets: current.totalTargets,
            sentCount: current.sentCount,
            failedCount: current.failedCount,
            progressPercent:
              current.totalTargets > 0
                ? Math.round((current.currentIndex / current.totalTargets) * 100)
                : 0,
            startedAt: current.startedAt,
            completedAt: current.completedAt,
            config: current.config,
          }
        : null,
      history: status.history.map((h) => ({
        id: h.id,
        status: h.status,
        totalTargets: h.totalTargets,
        sentCount: h.sentCount,
        failedCount: h.failedCount,
        createdAt: h.createdAt,
        completedAt: h.completedAt,
      })),
    });
  });

  // POST /api/broadcast/pause - Pause Running Broadcast
  fastify.post('/api/broadcast/pause', async (_request, reply) => {
    const paused = broadcastManager.pauseBroadcast();
    return reply.send({
      success: paused,
      message: paused ? 'Broadcast paused' : 'No running broadcast to pause',
    });
  });

  // POST /api/broadcast/resume - Resume Paused Broadcast
  fastify.post('/api/broadcast/resume', async (_request, reply) => {
    const resumed = broadcastManager.resumeBroadcast();
    return reply.send({
      success: resumed,
      message: resumed ? 'Broadcast resumed' : 'No paused broadcast to resume',
    });
  });

  // POST /api/broadcast/cancel - Cancel Active Broadcast
  fastify.post('/api/broadcast/cancel', async (_request, reply) => {
    const cancelled = broadcastManager.cancelBroadcast();
    return reply.send({
      success: cancelled,
      message: cancelled ? 'Broadcast cancelled' : 'No active broadcast to cancel',
    });
  });

  // POST /api/broadcast/preview - Preview Spintax Template
  fastify.post('/api/broadcast/preview', async (request, reply) => {
    const parse = previewSpintaxSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid preview payload',
        details: parse.error.format(),
      });
    }

    const { template, count, variables } = parse.data;
    const previewResult = previewSpintax(template, count, variables);

    return reply.send({
      success: true,
      template,
      totalVariations: previewResult.totalVariations,
      previews: previewResult.previews,
    });
  });
};
