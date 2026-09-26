import type { FastifyPluginAsync } from 'fastify';
import { waClient } from '../../../core/whatsapp.js';
import { messageQueue } from '../../../queue/messageQueue.js';
import { checkNumberSchema, sendMessageSchema, sendMediaSchema } from '../../schemas/apiSchemas.js';

export const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/check-number - Verify if phone number is registered on WhatsApp
  fastify.post('/api/check-number', async (request, reply) => {
    const parse = checkNumberSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload',
        details: parse.error.format(),
      });
    }

    if (!waClient.isConnected()) {
      return reply.code(503).send({
        success: false,
        error: 'WhatsApp is not connected. Current status: ' + waClient.getStatus(),
      });
    }

    try {
      const result = await waClient.checkNumber(parse.data.phoneNumber);
      return reply.send({
        success: true,
        phoneNumber: parse.data.phoneNumber,
        registered: result.registered,
        jid: result.jid,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to check phone number',
      });
    }
  });

  // POST /api/send-message - Send Text Message
  fastify.post('/api/send-message', async (request, reply) => {
    const parse = sendMessageSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload',
        details: parse.error.format(),
      });
    }

    if (!waClient.isConnected()) {
      return reply.code(503).send({
        success: false,
        error: 'WhatsApp is not connected. Current status: ' + waClient.getStatus(),
      });
    }

    try {
      const { to, message, queued } = parse.data;
      const result = await waClient.sendText(to, message, { queued });
      return reply.send({
        success: true,
        message: queued ? 'Message scheduled in anti-ban queue' : 'Message sent immediately',
        target: to,
        queueStatus: messageQueue.getStats(),
        result,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to send message',
      });
    }
  });

  // POST /api/send-media - Send Image/Doc/Video
  fastify.post('/api/send-media', async (request, reply) => {
    const parse = sendMediaSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload',
        details: parse.error.format(),
      });
    }

    if (!waClient.isConnected()) {
      return reply.code(503).send({
        success: false,
        error: 'WhatsApp is not connected. Current status: ' + waClient.getStatus(),
      });
    }

    try {
      const { to, type, url, caption, fileName, mimetype, queued } = parse.data;
      const result = await waClient.sendMedia(
        to,
        { type, url, caption, fileName, mimetype },
        { queued }
      );

      return reply.send({
        success: true,
        message: queued ? 'Media scheduled in anti-ban queue' : 'Media sent immediately',
        target: to,
        type,
        queueStatus: messageQueue.getStats(),
        result,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to send media',
      });
    }
  });
};
