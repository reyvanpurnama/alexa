import type { WASocket } from '@whiskeysockets/baileys';
import type { SerializedMessage } from '../core/serializer.js';
import type { config } from '../config/index.js';

export interface RoleResolution {
  role: string;
  data?: Record<string, any>;
}

export type RoleResolver = (
  senderNumber: string,
  m: SerializedMessage
) => Promise<RoleResolution | string> | RoleResolution | string;

export interface CommandContext {
  sock: WASocket;
  m: SerializedMessage;
  args: string[];
  text: string;
  config: typeof config;
  userRole?: string;
  roleData?: Record<string, any>;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  category?: 'general' | 'automation' | 'tools' | 'ai' | 'owner' | 'executive' | 'supplier' | 'member' | 'public' | string;
  ownerOnly?: boolean;
  groupOnly?: boolean;
  privateOnly?: boolean;
  hidden?: boolean;
  roles?: string[];
  execute: (ctx: CommandContext) => Promise<void>;
}

