import type { FastifyPluginAsync } from 'fastify';
import { localStore } from '../../../core/store/localStore.js';
import { logger } from '../../../utils/logger.js';

export interface SyncPayload {
  table: string;
  action?: 'upsert' | 'delete';
  primaryKey?: string;
  data?: Record<string, any>;
  id?: any;
}

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/sync/events - Ingest real-time business events from Web/POS/ERP into local SQLite
   * Supports single event or array of events (batching)
   */
  fastify.post('/api/sync/events', async (request, reply) => {
    const body = request.body;

    if (!body || (typeof body !== 'object' && !Array.isArray(body))) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid payload: Expected JSON object or array of sync events',
      });
    }

    let events: SyncPayload[] = [];
    if (Array.isArray(body)) {
      events = body;
    } else if (Array.isArray((body as any).events)) {
      events = (body as any).events;
    } else {
      events = [body as SyncPayload];
    }

    if (events.length === 0) {
      return reply.code(400).send({
        success: false,
        error: 'Empty events array',
      });
    }

    let processedCount = 0;
    const errors: { index: number; table: string; error: string }[] = [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event.table || typeof event.table !== 'string') {
        errors.push({ index: i, table: 'unknown', error: 'Missing or invalid "table" field' });
        continue;
      }

      const table = event.table.trim();
      const primaryKey = (event.primaryKey || 'id').trim();
      const action = event.action || 'upsert';

      try {
        if (action === 'delete') {
          const targetId = event.id ?? event.data?.[primaryKey];
          if (targetId === undefined || targetId === null) {
            errors.push({
              index: i,
              table,
              error: `Missing primary key value ("${primaryKey}") for delete action`,
            });
            continue;
          }
          localStore.deleteRecord(table, targetId, primaryKey);
        } else {
          // Default: upsert
          const data = event.data;
          if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            errors.push({ index: i, table, error: 'Missing or empty "data" object for upsert' });
            continue;
          }
          localStore.upsertRecord(table, data, primaryKey);
        }

        processedCount++;
      } catch (err: unknown) {
        errors.push({
          index: i,
          table,
          error: (err as Error).message || 'Failed to process event',
        });
      }
    }

    const hasErrors = errors.length > 0;
    const statusCode = hasErrors && processedCount === 0 ? 400 : 200;

    if (processedCount > 0) {
      logger.info(
        { processed: processedCount, total: events.length, errors: errors.length },
        '[Sync API] Successfully ingested real-time business events'
      );
    }

    return reply.code(statusCode).send({
      success: processedCount > 0,
      processed: processedCount,
      total: events.length,
      errors: hasErrors ? errors : undefined,
      store: localStore.getStats(),
    });
  });

  /**
   * GET /api/sync/status - Inspect local database health, tables, and auto-generated schema
   */
  fastify.get('/api/sync/status', async (_request, reply) => {
    return reply.send({
      success: true,
      store: localStore.getStats(),
      schema: localStore.getSchemaContext(),
    });
  });

  /**
   * POST /api/sync/query - Admin safe query explorer (Read-only, guarded)
   */
  fastify.post('/api/sync/query', async (request, reply) => {
    const { sql } = (request.body as { sql?: string }) || {};

    if (!sql || typeof sql !== 'string' || !sql.trim()) {
      return reply.code(400).send({
        success: false,
        error: 'Parameter "sql" query is required',
      });
    }

    try {
      const rows = localStore.executeSafeQuery(sql);
      return reply.send({
        success: true,
        count: rows.length,
        rows,
      });
    } catch (err: unknown) {
      return reply.code(400).send({
        success: false,
        error: (err as Error).message || 'Query execution error',
      });
    }
  });
};
