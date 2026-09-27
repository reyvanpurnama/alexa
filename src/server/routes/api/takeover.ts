import type { FastifyPluginAsync } from 'fastify';
import { takeoverManager } from '../../../services/ai/index.js';

export const takeoverRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/takeover/muted - Get all currently muted sessions
  fastify.get('/api/takeover/muted', async (_request, reply) => {
    const sessions = takeoverManager.getAllMuted();
    return reply.send({
      success: true,
      count: sessions.length,
      sessions,
    });
  });

  // POST /api/takeover/unmute - Unmute a specific number/session
  fastify.post('/api/takeover/unmute', async (request, reply) => {
    const { targetId } = (request.body as { targetId?: string }) || {};

    if (!targetId || !targetId.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'Parameter targetId (nomor telepon) wajib disertakan',
      });
    }

    const unmuted = takeoverManager.unmute(targetId.trim());

    return reply.send({
      success: unmuted,
      message: unmuted
        ? `Percakapan untuk ${targetId} berhasil diaktifkan kembali ke mode AI otonom.`
        : `Nomor ${targetId} tidak sedang dalam status jeda/mute.`,
    });
  });

  // POST /api/takeover/unmute-all - Unmute all muted sessions (anti-prank/bulk reset)
  fastify.post('/api/takeover/unmute-all', async (_request, reply) => {
    const count = takeoverManager.unmuteAll();
    return reply.send({
      success: true,
      count,
      message: `Berhasil mengaktifkan kembali ${count} percakapan ke mode AI otonom.`,
    });
  });

  // POST /api/takeover/mute - Manually mute a specific number from dashboard
  fastify.post('/api/takeover/mute', async (request, reply) => {
    const { targetId, durationMinutes = 30, reason = 'dashboard_manual_mute', senderName } =
      (request.body as {
        targetId?: string;
        durationMinutes?: number;
        reason?: string;
        senderName?: string;
      }) || {};

    if (!targetId || !targetId.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'Parameter targetId (nomor telepon) wajib disertakan',
      });
    }

    takeoverManager.mute(targetId.trim(), durationMinutes, reason, senderName);

    return reply.send({
      success: true,
      message: `Percakapan untuk ${targetId} berhasil dijeda selama ${durationMinutes} menit.`,
    });
  });
};
