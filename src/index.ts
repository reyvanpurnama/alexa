import { config } from './config/index.js';
import { waClient } from './core/whatsapp.js';
import { commandManager } from './core/commandManager.js';
import { startServer } from './server/index.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  logger.info(`Starting ${config.BOT_NAME}...`);

  try {
    // 1. Preload modular commands
    await commandManager.loadCommands();

    // 2. Start REST API Server
    await startServer();

    // 3. Initialize WhatsApp Socket
    await waClient.initialize();
  } catch (error) {
    logger.error({ error }, 'Fatal error during startup');
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully (SIGINT)...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully (SIGTERM)...');
  process.exit(0);
});

bootstrap();
