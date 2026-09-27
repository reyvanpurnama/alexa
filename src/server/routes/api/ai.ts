import type { FastifyPluginAsync } from 'fastify';
import { knowledgeManager, aiService } from '../../../services/ai/index.js';
import { saveBusinessDocSchema, faqItemSchema } from '../../schemas/apiSchemas.js';

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/knowledge - Inspect current active business knowledge context, doc, faqs and stats
  fastify.get('/api/knowledge', async (_request, reply) => {
    return reply.send({
      success: true,
      businessDoc: knowledgeManager.getBusinessDoc(),
      faqs: knowledgeManager.getFaqItems(),
      stats: knowledgeManager.getStats(),
      context: knowledgeManager.getKnowledgeContext(),
    });
  });

  // PUT /api/knowledge/business - Update business.md content
  fastify.put('/api/knowledge/business', async (request, reply) => {
    const parse = saveBusinessDocSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Data dokumen tidak valid',
        details: parse.error.format(),
      });
    }

    try {
      knowledgeManager.saveBusinessDoc(parse.data.content);
      return reply.send({
        success: true,
        message: 'Dokumen bisnis berhasil disimpan & diindeks ulang.',
        stats: knowledgeManager.getStats(),
        context: knowledgeManager.getKnowledgeContext(),
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Gagal menyimpan dokumen bisnis',
      });
    }
  });

  // POST /api/knowledge/faq - Add a new FAQ item
  fastify.post('/api/knowledge/faq', async (request, reply) => {
    const parse = faqItemSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Data FAQ tidak valid',
        details: parse.error.format(),
      });
    }

    try {
      const items = knowledgeManager.addFaqItem(parse.data);
      return reply.send({
        success: true,
        message: 'FAQ baru berhasil ditambahkan.',
        faqs: items,
        stats: knowledgeManager.getStats(),
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Gagal menambahkan FAQ',
      });
    }
  });

  // PUT /api/knowledge/faq/:index - Update an existing FAQ item
  fastify.put('/api/knowledge/faq/:index', async (request, reply) => {
    const { index } = request.params as { index: string };
    const numIndex = parseInt(index, 10);
    if (isNaN(numIndex)) {
      return reply.code(400).send({ success: false, error: 'Index FAQ tidak valid' });
    }

    const parse = faqItemSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Data FAQ tidak valid',
        details: parse.error.format(),
      });
    }

    try {
      const items = knowledgeManager.updateFaqItem(numIndex, parse.data);
      return reply.send({
        success: true,
        message: 'FAQ berhasil diperbarui.',
        faqs: items,
        stats: knowledgeManager.getStats(),
      });
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Gagal memperbarui FAQ',
      });
    }
  });

  // DELETE /api/knowledge/faq/:index - Delete an FAQ item
  fastify.delete('/api/knowledge/faq/:index', async (request, reply) => {
    const { index } = request.params as { index: string };
    const numIndex = parseInt(index, 10);
    if (isNaN(numIndex)) {
      return reply.code(400).send({ success: false, error: 'Index FAQ tidak valid' });
    }

    try {
      const items = knowledgeManager.deleteFaqItem(numIndex);
      return reply.send({
        success: true,
        message: 'FAQ berhasil dihapus.',
        faqs: items,
        stats: knowledgeManager.getStats(),
      });
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Gagal menghapus FAQ',
      });
    }
  });

  // POST /api/knowledge/reload - Re-index knowledge base files from disk
  fastify.post('/api/knowledge/reload', async (_request, reply) => {
    knowledgeManager.reload();
    return reply.send({
      success: true,
      message: 'Knowledge base reloaded successfully.',
      stats: knowledgeManager.getStats(),
      context: knowledgeManager.getKnowledgeContext(),
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
      const startTime = Date.now();
      const result = await aiService.generateResponse(prompt.trim());
      const latencyMs = Date.now() - startTime;
      return reply.send({
        success: true,
        prompt: prompt.trim(),
        response: result.text,
        withFooter: result.withFooter,
        usedTools: result.usedTools,
        latencyMs,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to generate AI response',
      });
    }
  });
};
