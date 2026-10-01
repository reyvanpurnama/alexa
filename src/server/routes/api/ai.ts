import type { FastifyPluginAsync } from 'fastify';
import { knowledgeManager, aiService, intentRouter } from '../../../services/ai/index.js';
import { settingsManager } from '../../../config/settingsManager.js';
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

  // GET /api/ai/intents - List all registered intents for the Intent Router catalog
  fastify.get('/api/ai/intents', async (_request, reply) => {
    const all = intentRouter.getAllIntents();
    const mapped = all.map((i) => ({
      name: i.name,
      description: i.description,
      roles: i.roles,
      patterns: (i.patterns || []).map((p) => (p instanceof RegExp ? p.source : String(p))),
      parameters: i.parameters || {},
    }));

    return reply.send({
      success: true,
      intents: mapped,
      total: mapped.length,
      enabled: settingsManager.getSettings().enableIntentRouter !== false,
    });
  });

  // PUT /api/ai/intents/toggle - Toggle Slim Intent Router enabled/disabled
  fastify.put('/api/ai/intents/toggle', async (request, reply) => {
    const { enabled } = (request.body as { enabled?: boolean }) || {};
    const updated = settingsManager.updateSettings({ enableIntentRouter: Boolean(enabled) });
    return reply.send({
      success: true,
      enabled: updated.enableIntentRouter !== false,
      message: `Slim Intent Router ${updated.enableIntentRouter !== false ? 'diaktifkan' : 'dinonaktifkan'}.`,
    });
  });

  // POST /api/ai/query - Test Grounded AI Query with simulated role & intent routing
  fastify.post('/api/ai/query', async (request, reply) => {
    const { prompt, simulatedRole } =
      (request.body as { prompt?: string; simulatedRole?: string }) || {};

    if (!prompt || !prompt.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'Prompt query cannot be empty',
      });
    }

    const cleanPrompt = prompt.trim();
    const targetRole = (simulatedRole || 'PUBLIC').toUpperCase();
    const startTime = Date.now();

    try {
      // 1. Pre-flight check: Slim Intent Router Hook (if enabled)
      if (settingsManager.getSettings().enableIntentRouter !== false) {
        const mockMsg: any = {
          from: 'simulator@test',
          senderNumber: 'simulator',
          isGroup: false,
          pushName: `Simulator (${targetRole})`,
          reply: async (text: string) => text,
          sendTyping: async () => {},
          markRead: async () => {},
          sock: {} as any,
        };

        const intentResult = await intentRouter.route({
          prompt: cleanPrompt,
          role: targetRole,
          roleData: { simulator: true },
          m: mockMsg,
          sock: {} as any,
        });

        if (intentResult.handled) {
          const latencyMs =
            intentResult.latencyMs !== undefined ? intentResult.latencyMs : Date.now() - startTime;

          return reply.send({
            success: true,
            prompt: cleanPrompt,
            response: intentResult.response || '',
            withFooter: intentResult.withFooter || false,
            usedTools: false,
            handled: true,
            intentName: intentResult.intentName,
            tier: intentResult.tier || 'tier1_pattern',
            simulatedRole: targetRole,
            latencyMs,
          });
        }
      }

      // 2. Fallback: Full Conversational AI Generator
      const result = await aiService.generateResponse(cleanPrompt);
      const latencyMs = Date.now() - startTime;

      return reply.send({
        success: true,
        prompt: cleanPrompt,
        response: result.text,
        withFooter: result.withFooter,
        usedTools: result.usedTools,
        handled: false,
        tier: 'full_ai',
        simulatedRole: targetRole,
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
