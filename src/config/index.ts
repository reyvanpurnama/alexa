import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_KEY: z.string().min(1, 'API_KEY must not be empty').default('wa_secret_token_12345'),

  // Bot Identity & Behavior
  BOT_NAME: z.string().default('Alexa'),
  PREFIX: z.string().default('/'),
  OWNER_NUMBERS: z
    .string()
    .default('')
    .transform((val) =>
      val
        .split(',')
        .map((num) => num.trim().replace(/\D/g, ''))
        .filter(Boolean)
    ),
  FOOTER_TEXT: z.string().optional(),

  // AI Engine (Multi-Provider: gemini | openai | groq | deepseek | ollama | custom)
  AI_PROVIDER: z.enum(['gemini', 'openai', 'groq', 'deepseek', 'ollama', 'custom']).default('gemini'),
  AI_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().optional().default(''),
  AI_BASE_URL: z.string().optional().default(''),
  AI_SYSTEM_PROMPT: z
    .string()
    .default('You are a helpful and polite assistant for our business. Keep responses concise and clear.'),
  AI_AUTO_REPLY: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  AI_MAX_HISTORY: z.coerce.number().default(6),
  AI_SESSION_TIMEOUT_MIN: z.coerce.number().default(15),

  // Webhook Forwarding
  WEBHOOK_URL: z.string().url().optional().or(z.literal('')).default(''),
  WEBHOOK_SECRET: z.string().optional().default(''),

  // WhatsApp Connection
  SESSION_NAME: z.string().default('alexa_session'),
  USE_PAIRING_CODE: z
    .string()
    .default('false')
    .transform((val) => val.toLowerCase() === 'true'),
  PAIRING_PHONE_NUMBER: z.string().optional().default(''),

  // Anti-Ban & Queuing
  MESSAGE_DELAY_MS: z.coerce.number().default(2500),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

const data = parsed.data;

export const config = {
  ...data,
  FOOTER_TEXT: data.FOOTER_TEXT || '',
};
