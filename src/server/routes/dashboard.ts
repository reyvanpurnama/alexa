import type { FastifyPluginAsync } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { config } from '../../config/index.js';
import { waClient } from '../../core/whatsapp.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const publicDir = path.resolve(process.cwd(), 'public/dashboard');

  // Serve static assets (CSS, JS modules) under /dashboard/
  await fastify.register(fastifyStatic, {
    root: publicDir,
    prefix: '/dashboard/',
    decorateReply: false,
  });

  // Serve main Dashboard page with runtime config injection
  fastify.get('/dashboard', async (_request, reply) => {
    const indexPath = path.join(publicDir, 'index.html');
    let html = await fs.promises.readFile(indexPath, 'utf-8');

    const clientConfig = {
      botName: config.BOT_NAME,
      apiKey: config.API_KEY,
      aiProvider: config.AI_PROVIDER,
      aiModel: config.AI_MODEL || 'default',
      activeSession: waClient.getActiveSessionName(),
    };

    const configScript = `<script>window.__ALEXA_CONFIG__ = ${JSON.stringify(clientConfig)};</script>`;
    html = html.replace('<!-- CONFIG_INJECTION -->', configScript);
    html = html.replace(
      'id="header-bot-name">Alexa</span>',
      `id="header-bot-name">${config.BOT_NAME}</span>`
    );
    html = html.replace(
      'id="overview-provider" style="font-size: 22px;">AI ENGINE</div>',
      `id="overview-provider" style="font-size: 22px;">${config.AI_PROVIDER.toUpperCase()}</div>`
    );
    html = html.replace(
      'id="overview-model">Knowledge base siap</div>',
      `id="overview-model">${config.AI_MODEL || 'default-model'} · Knowledge base siap</div>`
    );

    return reply.type('text/html').send(html);
  });
};
