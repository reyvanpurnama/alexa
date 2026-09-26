import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import cors from '@fastify/cors';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { apiRoutes } from './routes/api.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { waClient } from '../core/whatsapp.js';

export async function createServer() {
  const app = Fastify({
    logger: false, // We use custom Pino logger
  });

  await app.register(cors, {
    origin: '*',
  });

  // Swagger OpenAPI documentation
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: `${config.BOT_NAME} WhatsApp API`,
        description: 'REST API Gateway for WhatsApp notifications & automation',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header',
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // Root redirect to Apple HIG Web Dashboard
  app.get('/', async (_req, reply) => {
    return reply.redirect('/dashboard');
  });

  // Register Web Dashboard and API routes
  await app.register(dashboardRoutes);
  await app.register(apiRoutes);

  return app;
}

export async function startServer() {
  const app = await createServer();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(`HTTP server listening at http://${config.HOST}:${config.PORT}`);
    logger.info('API key authentication enabled');
  } catch (err) {
    logger.error({ err }, 'Failed to start Fastify server');
    process.exit(1);
  }
}
