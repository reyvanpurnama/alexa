import type { FastifyPluginAsync } from 'fastify';
import { chatLogger } from '../../../services/chat/chatLogger.js';

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/chats/recent - Fetch recent chat interactions
  fastify.get('/api/chats/recent', async (request, reply) => {
    const { limit = '30' } = request.query as { limit?: string };
    const numLimit = parseInt(limit, 10) || 30;

    const chats = chatLogger.getRecent(numLimit);
    const stats = chatLogger.getStats();

    return reply.send({
      success: true,
      count: chats.length,
      chats,
      stats,
    });
  });

  // GET /api/chats/stats - Fetch aggregate chat metrics
  fastify.get('/api/chats/stats', async (_request, reply) => {
    const stats = chatLogger.getStats();
    return reply.send({
      success: true,
      stats,
    });
  });

  // DELETE /api/chats/clear - Clear chat activity log
  fastify.delete('/api/chats/clear', async (_request, reply) => {
    const cleared = chatLogger.clear();
    return reply.send({
      success: cleared,
      message: cleared ? 'Riwayat percakapan berhasil dibersihkan' : 'Gagal membersihkan riwayat percakapan',
    });
  });
};
