import type { FastifyPluginAsync } from 'fastify';
import { waClient } from '../../../core/whatsapp.js';
import { pairingSchema, switchSessionSchema } from '../../schemas/apiSchemas.js';

export const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/pairing - Request Pairing Code for a phone number
  fastify.post('/api/pairing', async (request, reply) => {
    const parse = pairingSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload',
        details: parse.error.format(),
      });
    }

    try {
      const code = await waClient.requestPairing(parse.data.phoneNumber, parse.data.sessionName);
      return reply.send({
        success: true,
        message: 'Pairing code generated successfully. Enter this code in WhatsApp -> Linked Devices.',
        phoneNumber: parse.data.phoneNumber,
        sessionName: waClient.getActiveSessionName(),
        code,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to request pairing code',
      });
    }
  });

  // POST /api/session/logout - Disconnect active session and reset credentials for new pairing
  fastify.post('/api/session/logout', async (_request, reply) => {
    try {
      await waClient.logout();
      return reply.send({
        success: true,
        message: 'Session disconnected and credentials cleared. Ready for new pairing or QR scan.',
        status: waClient.getStatus(),
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to logout session',
      });
    }
  });

  // GET /api/sessions - List all saved session profiles and active session
  fastify.get('/api/sessions', async (_request, reply) => {
    return reply.send({
      success: true,
      activeSession: waClient.getActiveSessionName(),
      sessions: waClient.listSessions(),
    });
  });

  // POST /api/sessions/switch - Hot-swap active session without deleting credentials
  fastify.post('/api/sessions/switch', async (request, reply) => {
    const parse = switchSessionSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid session name payload',
        details: parse.error.format(),
      });
    }

    try {
      const result = await waClient.switchSession(parse.data.sessionName);
      return reply.send({
        message: result.isNew
          ? `Switched to new session "${result.sessionName}". Ready for pairing via POST /api/pairing.`
          : `Switched to existing session "${result.sessionName}". Connecting...`,
        ...result,
      });
    } catch (err: unknown) {
      return reply.code(500).send({
        success: false,
        error: (err as Error).message || 'Failed to switch session',
      });
    }
  });

  // DELETE /api/sessions/:sessionName - Delete an inactive session profile from disk
  fastify.delete('/api/sessions/:sessionName', async (request, reply) => {
    const { sessionName } = request.params as { sessionName: string };

    try {
      const deleted = waClient.deleteSession(sessionName);
      if (deleted) {
        return reply.send({
          success: true,
          message: `Session "${sessionName}" deleted successfully.`,
        });
      } else {
        return reply.code(404).send({
          success: false,
          error: `Session "${sessionName}" not found.`,
        });
      }
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Failed to delete session',
      });
    }
  });
};
