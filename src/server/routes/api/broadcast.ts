import type { FastifyPluginAsync } from 'fastify';
import { broadcastManager } from '../../../services/broadcast/index.js';
import { previewSpintax } from '../../../utils/spintax.js';
import { previewSpintaxSchema, startBroadcastSchema } from '../../schemas/apiSchemas.js';

export const broadcastRoutes: FastifyPluginAsync = async (fastify) => {
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
