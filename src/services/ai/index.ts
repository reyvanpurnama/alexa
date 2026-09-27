import { config } from '../../config/index.js';
import { settingsManager } from '../../config/settingsManager.js';
import { conversationMemory, type ChatMessage } from './memory.js';
import { takeoverManager } from './takeover.js';
import { messageDebouncer } from './debouncer.js';
import { aiTools, executeTool } from './tools.js';
import { knowledgeManager } from './knowledge.js';
import { localStore } from '../../core/store/localStore.js';
import { logger } from '../../utils/logger.js';
import { discoverAvailableModels, type DiscoveredModel, type ModelDiscoveryResult } from './modelDiscovery.js';
import { generateGemini } from './providers/geminiAdapter.js';
import { generateOpenAICompatible } from './providers/openaiAdapter.js';

export {
  conversationMemory,
  takeoverManager,
  messageDebouncer,
  knowledgeManager,
  discoverAvailableModels,
  type ChatMessage,
  type DiscoveredModel,
  type ModelDiscoveryResult,
};

export interface AIOptions {
  systemPrompt?: string;
  maxTokens?: number;
  sessionId?: string;
  senderName?: string;
}

export interface AIResponseResult {
  text: string;
  withFooter: boolean;
  usedTools: boolean;
}

class AIService {
  /**
   * Returns active AI runtime configuration with fallback to environment
   */
  getActiveConfig() {
    const s = settingsManager.getSettings();
    const provider = s.aiProvider || config.AI_PROVIDER;
    const apiKey = s.aiApiKey !== undefined && s.aiApiKey !== '' ? s.aiApiKey : config.AI_API_KEY;
    const model = s.aiModel !== undefined && s.aiModel !== '' ? s.aiModel : config.AI_MODEL;
    const baseUrl = s.aiBaseUrl !== undefined && s.aiBaseUrl !== '' ? s.aiBaseUrl : config.AI_BASE_URL;

    return { provider, apiKey, model, baseUrl };
  }

  /**
   * Pre-flight credential verification (Apple HIG Instant Verification)
   */
  async testConnection(testConfig?: {
    provider?: string;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }): Promise<{ success: boolean; latencyMs: number; reply?: string; error?: string }> {
    const active = this.getActiveConfig();
    const provider = (testConfig?.provider || active.provider) as any;
    const apiKey =
      testConfig?.apiKey && !testConfig.apiKey.includes('•••')
        ? testConfig.apiKey.trim()
        : active.apiKey;
    const model = testConfig?.model?.trim() || active.model;
    const baseUrl = testConfig?.baseUrl?.trim() || active.baseUrl;

    const startTime = Date.now();
    try {
      const testPrompt = 'Halo! Mohon balas satu kata saja untuk verifikasi koneksi: "Online".';
      let replyText = '';

      if (provider === 'gemini') {
        replyText = await generateGemini({
          prompt: testPrompt,
          systemPrompt: '',
          history: [],
          apiKey,
          model,
        });
      } else {
        const res = await generateOpenAICompatible({
          prompt: testPrompt,
          systemPrompt: '',
          provider,
          history: [],
          apiKey,
          model,
          baseUrl,
        });
        replyText = res.text;
      }

      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        latencyMs,
        reply: replyText.trim(),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        latencyMs,
        error: err?.message || 'Gagal terhubung ke penyedia AI',
      };
    }
  }

  /**
   * Dynamically retrieves available models from provider API, falling back to curated presets
   */
  async getAvailableModels(queryConfig?: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
  }): Promise<ModelDiscoveryResult> {
    const active = this.getActiveConfig();
    const provider = queryConfig?.provider || active.provider;
    const apiKey =
      queryConfig?.apiKey && !queryConfig.apiKey.includes('•••')
        ? queryConfig.apiKey.trim()
        : active.apiKey;
    const baseUrl = queryConfig?.baseUrl?.trim() || active.baseUrl;

    return discoverAvailableModels({ provider, apiKey, baseUrl });
  }

  /**
   * Generates text response using the configured AI provider,
   * grounded with business knowledge base, dynamic SQLite schema, multi-turn memory, and autonomous tool calling.
   */
  async generateResponse(prompt: string, options?: AIOptions): Promise<AIResponseResult> {
    const aiConfig = this.getActiveConfig();
    const provider = aiConfig.provider;
    const baseSystemPrompt = options?.systemPrompt || config.AI_SYSTEM_PROMPT;
    const isOwner = Boolean(
      options?.sessionId && config.OWNER_NUMBERS.includes(options.sessionId)
    );
    const knowledgeContext = knowledgeManager.getKnowledgeContext();
    let systemPrompt = knowledgeContext
      ? `${baseSystemPrompt}\n\n${knowledgeContext}`
      : baseSystemPrompt;

    const schemaContext = localStore.getSchemaContext();
    if (schemaContext) {
      systemPrompt += `\n\n${schemaContext}\n\n[PANDUAN KUERI DATA BISNIS LOKAL]:
Jika pengguna (terutama owner/admin) menanyakan informasi atau analitik yang relevan dengan tabel di atas (misal omzet, rekap transaksi, ranking produk, performa kasir), GUNAKAN tool "query_business_data" untuk menjalankan kueri SQL SELECT yang efisien dan akurat. Sajikan hasil dalam format Apple HIG Quiet UI: ringkas, angka terstruktur, dan ramah dibaca.`;
    }

    if (isOwner) {
      systemPrompt += `\n\n[USER RECOGNITION — AUTHENTICATED OWNER (+${options?.sessionId})]:
This user is an AUTHENTICATED OWNER/ADMIN of the system (+${options?.sessionId}). Provide professional, direct, and helpful administrative assistance.`;
    }

    const history = options?.sessionId ? conversationMemory.getHistory(options.sessionId) : [];
    const isFirstMessageInSession = history.length === 0;

    let responseText = '';
    let usedTools = false;

    switch (provider) {
      case 'gemini': {
        responseText = await generateGemini({
          prompt,
          systemPrompt,
          history,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
        });
        break;
      }

      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'ollama':
      case 'custom': {
        const result = await generateOpenAICompatible({
          prompt,
          systemPrompt,
          provider,
          history,
          sessionId: options?.sessionId,
          senderName: options?.senderName,
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          baseUrl: aiConfig.baseUrl,
        });
        responseText = result.text;
        usedTools = result.usedTools;
        break;
      }

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    if (options?.sessionId && responseText) {
      conversationMemory.addMessage(options.sessionId, 'user', prompt);
      conversationMemory.addMessage(options.sessionId, 'assistant', responseText);
    }

    const currentFooter = settingsManager.getSettings().footerText?.trim() || '';
    const hasFooter = currentFooter.length > 0;
    const isDataQuery =
      usedTools ||
      /(omzet|laba|transaksi|simpanan|pinjaman|anggota|laporan|penjualan|stok|supplier)/i.test(prompt);
    // Apple HIG Quiet UI: Only attach footer on first interaction in session or comprehensive data queries
    const withFooter = hasFooter && (isFirstMessageInSession || isDataQuery);

    return {
      text: responseText,
      withFooter,
      usedTools,
    };
  }
}

export const aiService = new AIService();
