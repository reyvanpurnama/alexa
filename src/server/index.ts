import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import cors from '@fastify/cors';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { apiRoutes } from './routes/api.js';
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

  // Root landing endpoint
  app.get('/', async (_req, reply) => {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${config.BOT_NAME} - WhatsApp Automation Engine</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; }
            h1 { color: #128C7E; border-bottom: 2px solid #25D366; padding-bottom: 10px; }
            .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-weight: bold; background: #e0f2fe; color: #0369a1; }
            .badge.CONNECTED { background: #dcfce7; color: #15803d; }
            .badge.DISCONNECTED { background: #fee2e2; color: #b91c1c; }
            .badge.QR_READY { background: #fef3c7; color: #b45309; }
            code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
            pre { background: #1e293b; color: #f8fafc; padding: 14px; border-radius: 8px; overflow-x: auto; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
          </style>
        </head>
        <body>
          <h1>${config.BOT_NAME} - WhatsApp Gateway & Automation API</h1>
          <p>Status: <span class="badge ${waClient.getStatus()}">${waClient.getStatus()}</span></p>
          <p><a href="/docs" style="display:inline-block; padding: 10px 18px; background: #25D366; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0;">📖 Open Interactive Swagger API Docs (/docs)</a></p>
          <div class="card">
            <h3>Quick API Endpoints:</h3>
            <ul>
              <li><code>GET /api/status</code> - Check bot connection state & queue stats</li>
              <li><code>POST /api/pairing</code> - Request 8-digit Pairing Code</li>
              <li><code>POST /api/send-message</code> - Send notification message (queued with anti-ban)</li>
              <li><code>POST /api/send-media</code> - Send image, invoice PDF, video, audio</li>
            </ul>
          </div>
          <div class="card">
            <h3>Example: Send Message via curl</h3>
            <pre>curl -X POST http://localhost:${config.PORT}/api/send-message \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${config.API_KEY}" \\
  -d '{
    "to": "08123456789",
    "message": "Halo! Pesanan Anda telah dikirim 🚀"
  }'</pre>
          </div>
        </body>
      </html>
    `);
  });

  // Register API routes
  await app.register(apiRoutes);

  return app;
}

export async function startServer() {
  const app = await createServer();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    logger.info(`🌐 REST API Server running at http://${config.HOST}:${config.PORT}`);
    logger.info(`🔒 API Key protection active: x-api-key: ${config.API_KEY}`);
  } catch (err) {
    logger.error({ err }, 'Failed to start Fastify server');
    process.exit(1);
  }
}
