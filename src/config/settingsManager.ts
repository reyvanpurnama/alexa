import path from 'path';
import fs from 'fs';
import { config } from './index.js';
import { logger } from '../utils/logger.js';
import { messageQueue } from '../queue/messageQueue.js';

export interface DynamicSettings {
  botName: string;
  prefix: string;
  footerText: string;
  ownerNumbers: string[];
  aiAutoReply: boolean;
  messageDelayMs: number;
}

export class SettingsManager {
  private dataDir = path.join(process.cwd(), 'data');
  private filePath = path.join(process.cwd(), 'data', 'settings.json');
  private settings: DynamicSettings;

  constructor() {
    this.ensureDataDir();
    this.settings = this.loadSettings();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadSettings(): DynamicSettings {
    const defaults: DynamicSettings = {
      botName: config.BOT_NAME,
      prefix: config.PREFIX,
      footerText: config.FOOTER_TEXT,
      ownerNumbers: [...config.OWNER_NUMBERS],
      aiAutoReply: config.AI_AUTO_REPLY,
      messageDelayMs: config.MESSAGE_DELAY_MS,
    };

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...defaults,
          ...parsed,
          ownerNumbers: Array.isArray(parsed.ownerNumbers)
            ? Array.from(new Set(parsed.ownerNumbers.map((n: string) => n.trim().replace(/\D/g, '')).filter(Boolean)))
            : defaults.ownerNumbers,
        };
      } catch (err) {
        logger.error({ err }, '[SettingsManager] Failed to parse settings.json, falling back to defaults');
        return defaults;
      }
    }

    // Persist initial defaults to file
    this.saveSettingsToFile(defaults);
    return defaults;
  }

  private saveSettingsToFile(settings: DynamicSettings): void {
    try {
      this.ensureDataDir();
      fs.writeFileSync(this.filePath, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (err) {
      logger.error({ err }, '[SettingsManager] Failed to write settings to disk');
    }
  }

  getSettings(): DynamicSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<DynamicSettings>): DynamicSettings {
    const updated: DynamicSettings = {
      ...this.settings,
      ...partial,
    };

    if (partial.messageDelayMs && partial.messageDelayMs !== this.settings.messageDelayMs) {
      messageQueue.setDelay(partial.messageDelayMs);
    }

    this.settings = updated;
    this.saveSettingsToFile(this.settings);
    logger.info('[SettingsManager] Dynamic settings updated and hot-reloaded');

    return { ...this.settings };
  }

  addOwnerNumber(rawNumber: string): { success: boolean; ownerNumbers: string[] } {
    const cleanNumber = rawNumber.trim().replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 8) {
      throw new Error('Nomor telepon owner tidak valid (minimal 8 digit)');
    }

    const current = new Set(this.settings.ownerNumbers);
    current.add(cleanNumber);

    this.settings.ownerNumbers = Array.from(current);
    this.saveSettingsToFile(this.settings);
    logger.info(`[SettingsManager] Added owner number: +${cleanNumber}`);

    return {
      success: true,
      ownerNumbers: this.settings.ownerNumbers,
    };
  }

  removeOwnerNumber(rawNumber: string): { success: boolean; ownerNumbers: string[] } {
    const cleanNumber = rawNumber.trim().replace(/\D/g, '');
    const current = new Set(this.settings.ownerNumbers);

    if (current.size <= 1 && current.has(cleanNumber)) {
      throw new Error('Minimal harus tersisa 1 nomor pengelola (owner).');
    }

    current.delete(cleanNumber);
    this.settings.ownerNumbers = Array.from(current);
    this.saveSettingsToFile(this.settings);
    logger.info(`[SettingsManager] Removed owner number: +${cleanNumber}`);

    return {
      success: true,
      ownerNumbers: this.settings.ownerNumbers,
    };
  }

  isOwner(phoneOrJid: string): boolean {
    const clean = phoneOrJid.split('@')[0].split(':')[0].replace(/\D/g, '');
    return this.settings.ownerNumbers.includes(clean);
  }
}

export const settingsManager = new SettingsManager();
