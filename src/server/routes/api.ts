import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/index.js';
import { systemRoutes } from './api/system.js';
import { sessionsRoutes } from './api/sessions.js';
import { messagesRoutes } from './api/messages.js';
import { broadcastRoutes } from './api/broadcast.js';
import { aiRoutes } from './api/ai.js';

export const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Authentication preHandler hook for protected API routes
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

  // Register modular domain sub-routes
  await fastify.register(systemRoutes);
  await fastify.register(sessionsRoutes);
  await fastify.register(messagesRoutes);
  await fastify.register(broadcastRoutes);
  await fastify.register(aiRoutes);
};
