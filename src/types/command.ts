import type { WASocket } from '@whiskeysockets/baileys';
import type { SerializedMessage } from '../core/serializer.js';
import type { config } from '../config/index.js';

export interface CommandContext {
  sock: WASocket;
  m: SerializedMessage;
  args: string[];
  text: string;
  config: typeof config;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  category?: 'general' | 'automation' | 'tools' | 'ai' | 'owner';
  ownerOnly?: boolean;
  groupOnly?: boolean;
  privateOnly?: boolean;
  hidden?: boolean;
  execute: (ctx: CommandContext) => Promise<void>;
}
