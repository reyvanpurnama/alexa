import type { FastifyPluginAsync } from 'fastify';
import { settingsManager } from '../../../config/settingsManager.js';
import { updateSettingsSchema, addOwnerSchema } from '../../schemas/apiSchemas.js';

export const settingsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/settings - Retrieve all current dynamic operational settings
  fastify.get('/api/settings', async (_request, reply) => {
    return reply.send({
      success: true,
      settings: settingsManager.getSettings(),
    });
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
};
