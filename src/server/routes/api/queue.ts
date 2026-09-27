import type { FastifyPluginAsync } from 'fastify';
import { messageQueue } from '../../../queue/messageQueue.js';
import { messageTracker } from '../../../services/messages/messageTracker.js';
import { waClient } from '../../../core/whatsapp.js';

export const queueRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/queue/status - Real-time metrics of the outbound queue and delivery tracker
  fastify.get('/api/queue/status', async (_request, reply) => {
    return reply.send({
      success: true,
      whatsappStatus: waClient.getStatus(),
      isConnected: waClient.isConnected(),
      queue: messageQueue.getStats(),
      deliveryStats: messageTracker.getStats(),
    });
  });

  // POST /api/queue/pause - Manually pause outbound message processing
  fastify.post('/api/queue/pause', async (_request, reply) => {
    messageQueue.pause();
    return reply.send({
      success: true,
      message: 'Antrean pesan berhasil dijeda (paused).',
      queue: messageQueue.getStats(),
    });
  });

  // POST /api/queue/resume - Manually resume outbound message processing
  fastify.post('/api/queue/resume', async (_request, reply) => {
    messageQueue.resume();
    return reply.send({
      success: true,
      message: 'Antrean pesan berhasil dilanjutkan (resumed).',
      queue: messageQueue.getStats(),
    });
  });

  // POST /api/queue/clear - Clear all pending messages in queue
  fastify.post('/api/queue/clear', async (_request, reply) => {
    messageQueue.clear();
    return reply.send({
      success: true,
      message: 'Seluruh antrean pesan tertunda berhasil dibersihkan.',
      queue: messageQueue.getStats(),
    });
  });
};
