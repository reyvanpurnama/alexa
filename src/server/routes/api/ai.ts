import type { FastifyPluginAsync } from 'fastify';
import { knowledgeManager, aiService } from '../../../services/ai/index.js';

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
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
};
