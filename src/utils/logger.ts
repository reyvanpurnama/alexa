import pino from 'pino';

// Main application logger
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
    },
  },
});

// Baileys internal logger (set to 'error' or 'warn' to avoid terminal spam)
export const baileysLogger = pino({
  level: 'warn',
});
