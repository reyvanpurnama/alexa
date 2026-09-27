import type { FastifyPluginAsync } from 'fastify';
import { waClient } from '../../../core/whatsapp.js';
import { messageQueue } from '../../../queue/messageQueue.js';
import { messageTracker, type DeliveryStatus } from '../../../services/messages/messageTracker.js';
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

  // POST /api/send-message - Send Text Message (Immediate or Queued with Lifecycle Tracing)
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
      const { to, message, queued, referenceId, messageId } = parse.data;
      const result = await waClient.sendText(to, message, {
        queued,
        referenceId,
        messageId,
      });

      const httpStatus = result.status === 'queued' ? 202 : 200;
      return reply.code(httpStatus).send({
        success: true,
        status: result.status,
        message:
          result.status === 'queued'
            ? 'Message accepted into anti-ban queue'
            : 'Message sent immediately',
        messageId: result.messageId,
        referenceId: result.referenceId,
        target: result.to,
        queue: messageQueue.getStats(),
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
      const { to, type, url, caption, fileName, mimetype, queued, referenceId, messageId } =
        parse.data;
      const result = await waClient.sendMedia(
        to,
        { type, url, caption, fileName, mimetype },
        { queued, referenceId, messageId }
      );

      const httpStatus = result.status === 'queued' ? 202 : 200;
      return reply.code(httpStatus).send({
        success: true,
        status: result.status,
        message:
          result.status === 'queued'
            ? 'Media accepted into anti-ban queue'
            : 'Media sent immediately',
        messageId: result.messageId,
        referenceId: result.referenceId,
        target: result.to,
        type,
        queue: messageQueue.getStats(),
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to send media',
      });
    }
  });

  // GET /api/messages/status - Check delivery status by client referenceId
  fastify.get('/api/messages/status', async (request, reply) => {
    const { referenceId } = request.query as { referenceId?: string };
    if (!referenceId || !referenceId.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'Query parameter "referenceId" is required',
      });
    }

    const record = messageTracker.getByReferenceId(referenceId.trim());
    if (!record) {
      return reply.code(404).send({
        success: false,
        error: `No message found for referenceId "${referenceId}"`,
      });
    }

    return reply.send({
      success: true,
      message: record,
    });
  });

  // GET /api/messages/:id/status - Check delivery status by WhatsApp messageId
  fastify.get('/api/messages/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = messageTracker.getById(id);

    if (!record) {
      return reply.code(404).send({
        success: false,
        error: `No message found for ID "${id}" or record has expired from cache`,
      });
    }

    return reply.send({
      success: true,
      message: record,
    });
  });

  // GET /api/messages/recent - Inspect recent outbound messages & queue health
  fastify.get('/api/messages/recent', async (request, reply) => {
    const { limit, status } = request.query as { limit?: string; status?: DeliveryStatus };
    const numLimit = Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50));

    const records = messageTracker.getRecent(numLimit, status);
    return reply.send({
      success: true,
      count: records.length,
      stats: messageTracker.getStats(),
      queue: messageQueue.getStats(),
      messages: records,
    });
  });
};
