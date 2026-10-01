import type { FastifyPluginAsync } from 'fastify';
import { settingsManager } from '../../../config/settingsManager.js';
import { aiService } from '../../../services/ai/index.js';
import { updateSettingsSchema, addOwnerSchema } from '../../schemas/apiSchemas.js';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/settings - Retrieve all current dynamic operational settings
  fastify.get('/api/settings', async (_request, reply) => {
    return reply.send({
      success: true,
      settings: settingsManager.getSettings(),
    });
  });

  // GET /api/settings/ai - Inspect current active AI model and masked credentials
  fastify.get('/api/settings/ai', async (_request, reply) => {
    return reply.send({
      success: true,
      ai: settingsManager.getAISettings(),
    });
  });

  // PUT /api/settings/ai - Update dynamic AI credentials, model, or provider
  fastify.put('/api/settings/ai', async (request, reply) => {
    const body =
      (request.body as {
        provider?: any;
        apiKey?: string;
        model?: string;
        baseUrl?: string;
      }) || {};

    if (
      body.provider &&
      !['gemini', 'openai', 'groq', 'deepseek', 'ollama', 'custom'].includes(body.provider)
    ) {
      return reply.code(400).send({
        success: false,
        error: 'Penyedia AI tidak didukung. Pilih: gemini, openai, groq, deepseek, ollama, atau custom.',
      });
    }

    try {
      settingsManager.updateAISettings(body);
      return reply.send({
        success: true,
        message: 'Konfigurasi model & kredensial AI berhasil diperbarui dan aktif seketika.',
        ai: settingsManager.getAISettings(),
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Gagal memperbarui konfigurasi AI',
      });
    }
  });

  // POST /api/settings/ai/test - Pre-flight test connection (Apple HIG verification)
  fastify.post('/api/settings/ai/test', async (request, reply) => {
    const body =
      (request.body as {
        provider?: string;
        apiKey?: string;
        model?: string;
        baseUrl?: string;
      }) || {};

    const testResult = await aiService.testConnection(body);
    return reply.send(testResult);
  });

  // POST /api/settings/ai/models - Dynamically fetch models for provider & key
  fastify.post('/api/settings/ai/models', async (request, reply) => {
    const body =
      (request.body as {
        provider?: string;
        apiKey?: string;
        baseUrl?: string;
      }) || {};

    const result = await aiService.getAvailableModels(body);
    return reply.send(result);
  });

  // PUT /api/settings - Update general dynamic settings (botName, prefix, footerText, aiAutoReply, messageDelayMs)
  fastify.put('/api/settings', async (request, reply) => {
    const parse = updateSettingsSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload',
        details: parse.error.format(),
      });
    }

    try {
      const updated = settingsManager.updateSettings(parse.data);
      return reply.send({
        success: true,
        message: 'Pengaturan berhasil diperbarui dan aktif secara instan.',
        settings: updated,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Gagal memperbarui pengaturan',
      });
    }
  });

  // POST /api/settings/owners - Add a new owner phone number
  fastify.post('/api/settings/owners', async (request, reply) => {
    const parse = addOwnerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Nomor telepon tidak valid',
        details: parse.error.format(),
      });
    }

    try {
      const result = settingsManager.addOwnerNumber(parse.data.phoneNumber);
      return reply.send({
        success: true,
        message: 'Nomor pengelola berhasil ditambahkan.',
        ownerNumbers: result.ownerNumbers,
      });
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Gagal menambahkan nomor pengelola',
      });
    }
  });

  // DELETE /api/settings/owners/:phoneNumber - Remove an owner phone number
  fastify.delete('/api/settings/owners/:phoneNumber', async (request, reply) => {
    const { phoneNumber } = request.params as { phoneNumber: string };

    try {
      const result = settingsManager.removeOwnerNumber(phoneNumber);
      return reply.send({
        success: true,
        message: 'Nomor pengelola berhasil dihapus.',
        ownerNumbers: result.ownerNumbers,
      });
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Gagal menghapus nomor pengelola',
      });
    }
  });

  // GET /api/settings/roles - List all configured RBAC user roles & owners
  fastify.get('/api/settings/roles', async (_request, reply) => {
    return reply.send({
      success: true,
      userRoles: settingsManager.getUserRoles(),
      ownerNumbers: settingsManager.getSettings().ownerNumbers,
    });
  });

  // POST /api/settings/roles - Assign or update role for a phone number
  fastify.post('/api/settings/roles', async (request, reply) => {
    const body = (request.body as { phone?: string; role?: string; name?: string; data?: Record<string, any> }) || {};
    if (!body.phone || !body.role) {
      return reply.code(400).send({
        success: false,
        error: 'Nomor telepon dan peran (role) wajib diisi.',
      });
    }

    try {
      const record = settingsManager.setUserRole(body.phone, body.role, body.name, body.data);
      return reply.send({
        success: true,
        message: `Peran ${record.role} berhasil ditetapkan ke +${body.phone.replace(/\D/g, '')}`,
        record,
        userRoles: settingsManager.getUserRoles(),
        ownerNumbers: settingsManager.getSettings().ownerNumbers,
      });
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Gagal menetapkan peran pengguna',
      });
    }
  });

  // DELETE /api/settings/roles/:phoneNumber - Remove role assignment
  fastify.delete('/api/settings/roles/:phoneNumber', async (request, reply) => {
    const { phoneNumber } = request.params as { phoneNumber: string };

    try {
      const removed = settingsManager.removeUserRole(phoneNumber);
      return reply.send({
        success: true,
        message: removed ? 'Peran pengguna berhasil dihapus.' : 'Nomor tidak ditemukan dalam daftar peran.',
        userRoles: settingsManager.getUserRoles(),
        ownerNumbers: settingsManager.getSettings().ownerNumbers,
      });
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Gagal menghapus peran pengguna',
      });
    }
  });
};
