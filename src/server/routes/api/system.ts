import type { FastifyPluginAsync } from 'fastify';
import { waClient } from '../../../core/whatsapp.js';
import { messageQueue } from '../../../queue/messageQueue.js';
import { alertService } from '../../../services/alerts/index.js';
import { config } from '../../../config/index.js';

export const systemRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/status - Live bot health, connection, and queue metrics
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
};
