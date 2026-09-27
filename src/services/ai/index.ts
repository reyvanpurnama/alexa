import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { settingsManager } from '../../config/settingsManager.js';
import { conversationMemory, type ChatMessage } from './memory.js';
import { takeoverManager } from './takeover.js';
import { messageDebouncer } from './debouncer.js';
import { aiTools, executeTool } from './tools.js';
import { knowledgeManager } from './knowledge.js';
import { localStore } from '../../core/store/localStore.js';
import { logger } from '../../utils/logger.js';

export { conversationMemory, takeoverManager, messageDebouncer, knowledgeManager, type ChatMessage };

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
        replyText = await this.generateGemini(testPrompt, '', [], apiKey, model);
      } else {
        const res = await this.generateOpenAICompatible(testPrompt, '', provider, [], undefined, undefined, {
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
  }): Promise<{
    success: boolean;
    models: Array<{ id: string; label: string; description?: string }>;
    source: 'api' | 'preset';
    warning?: string;
  }> {
    const active = this.getActiveConfig();
    const provider = (queryConfig?.provider || active.provider) as any;
    const apiKey =
      queryConfig?.apiKey && !queryConfig.apiKey.includes('•••')
        ? queryConfig.apiKey.trim()
        : active.apiKey;
    const baseUrl = queryConfig?.baseUrl?.trim() || active.baseUrl;

    const presets: Record<string, Array<{ id: string; label: string }>> = {
      groq: [
        { id: 'openai/gpt-oss-120b', label: 'openai/gpt-oss-120b (Rekomendasi - Cerdas & Cepat)' },
        { id: 'openai/gpt-oss-20b', label: 'openai/gpt-oss-20b (Ultra Cepat & Hemat)' },
        { id: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile (Serbaguna)' },
        { id: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant (Super Cepat)' },
        { id: 'deepseek-r1-distill-llama-70b', label: 'deepseek-r1-distill-llama-70b (Penalaran)' },
        { id: 'qwen/qwen3.8-27b', label: 'qwen/qwen3.8-27b' },
      ],
      gemini: [
        { id: 'gemini-1.5-flash', label: 'gemini-1.5-flash (Rekomendasi - Responsif & Hemat)' },
        { id: 'gemini-1.5-pro', label: 'gemini-1.5-pro (Konteks Ekstra Besar)' },
        { id: 'gemini-2.0-flash', label: 'gemini-2.0-flash (Generasi Teranyar)' },
        { id: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite' },
      ],
      openai: [
        { id: 'gpt-4o-mini', label: 'gpt-4o-mini (Rekomendasi - Cerdas & Efisien)' },
        { id: 'gpt-4o', label: 'gpt-4o (Flagship Multimodal)' },
        { id: 'o3-mini', label: 'o3-mini (Penalaran STEM)' },
        { id: 'gpt-4-turbo', label: 'gpt-4-turbo' },
        { id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
      ],
      deepseek: [
        { id: 'deepseek-chat', label: 'deepseek-chat (DeepSeek-V3)' },
        { id: 'deepseek-reasoner', label: 'deepseek-reasoner (DeepSeek-R1)' },
      ],
      ollama: [
        { id: 'llama3:latest', label: 'llama3:latest' },
        { id: 'qwen2.5:latest', label: 'qwen2.5:latest' },
        { id: 'mistral:latest', label: 'mistral:latest' },
        { id: 'deepseek-r1:latest', label: 'deepseek-r1:latest' },
      ],
      custom: [{ id: 'default', label: 'default' }],
    };

    if (!apiKey && provider !== 'ollama' && provider !== 'custom') {
      return {
        success: true,
        models: presets[provider] || presets.groq,
        source: 'preset',
        warning: 'Kunci API belum diisi. Menampilkan daftar model rekomendasi.',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.models)) {
            const chatModels = data.models
              .filter(
                (m: any) =>
                  m.supportedGenerationMethods?.includes('generateContent') &&
                  !m.name.includes('embedding') &&
                  !m.name.includes('aqa')
              )
              .map((m: any) => {
                const id = m.name.replace(/^models\//, '');
                const label = m.displayName ? `${id} (${m.displayName})` : id;
                return { id, label, description: m.description };
              });

            if (chatModels.length > 0) {
              return { success: true, models: chatModels, source: 'api' };
            }
          }
        }
      } else if (provider === 'groq') {
        const url = 'https://api.groq.com/openai/v1/models';
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.data)) {
            const models = data.data
              .filter((m: any) => m.active !== false && !m.id.includes('whisper'))
              .map((m: any) => ({
                id: m.id,
                label: m.id,
              }));

            if (models.length > 0) {
              return { success: true, models, source: 'api' };
            }
          }
        }
      } else if (provider === 'openai') {
        const url = 'https://api.openai.com/v1/models';
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.data)) {
            const allowedPrefixes = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'chatgpt'];
            const models = data.data
              .filter(
                (m: any) =>
                  allowedPrefixes.some((p: string) => m.id.startsWith(p)) &&
                  !m.id.includes('audio') &&
                  !m.id.includes('realtime') &&
                  !m.id.includes('transcription')
              )
              .sort((a: any, b: any) => (b.created || 0) - (a.created || 0))
              .map((m: any) => ({
                id: m.id,
                label: m.id,
              }));

            if (models.length > 0) {
              return { success: true, models, source: 'api' };
            }
          }
        }
      } else if (provider === 'deepseek') {
        const url = 'https://api.deepseek.com/models';
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.data)) {
            const models = data.data.map((m: any) => ({ id: m.id, label: m.id }));
            if (models.length > 0) {
              return { success: true, models, source: 'api' };
            }
          }
        }
      } else if (provider === 'ollama') {
        const host = baseUrl || 'http://localhost:11434';
        const url = `${host.replace(/\/v1\/?$/, '')}/api/tags`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.models)) {
            const models = data.models.map((m: any) => ({ id: m.name, label: m.name }));
            if (models.length > 0) {
              return { success: true, models, source: 'api' };
            }
          }
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, provider }, '[AI] Failed to query remote models list');
    }

    return {
      success: true,
      models: presets[provider] || presets.groq,
      source: 'preset',
    };
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
      case 'gemini':
        responseText = await this.generateGemini(prompt, systemPrompt, history);
        break;

      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'ollama':
      case 'custom': {
        const result = await this.generateOpenAICompatible(
          prompt,
          systemPrompt,
          provider,
          history,
          options?.sessionId,
          options?.senderName
        );
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

  /**
   * Google Gemini Implementation with chat history support
   */
  private async generateGemini(
    prompt: string,
    systemPrompt: string,
    history: ChatMessage[],
    overrideApiKey?: string,
    overrideModel?: string
  ): Promise<string> {
    const aiConfig = this.getActiveConfig();
    const apiKey = overrideApiKey || aiConfig.apiKey;
    if (!apiKey) {
      throw new Error('AI_API_KEY belum dikonfigurasi untuk penyedia Gemini.');
    }

    const modelName = overrideModel || aiConfig.model || 'gemini-1.5-flash';
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt ? { role: 'system', parts: [{ text: systemPrompt }] } : undefined,
    });

    if (history.length > 0) {
      const geminiHistory = history.map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }],
      }));

      const chat = model.startChat({
        history: geminiHistory,
      });

      const result = await chat.sendMessage(prompt);
      const res = await result.response;
      return res.text().trim();
    }

    const result = await model.generateContent(prompt);
    const res = await result.response;
    return res.text().trim();
  }

  /**
   * Universal OpenAI-compatible Implementation with native Tool / Function Calling support
   */
  private async generateOpenAICompatible(
    prompt: string,
    systemPrompt: string,
    provider: 'openai' | 'groq' | 'deepseek' | 'ollama' | 'custom',
    history: ChatMessage[],
    sessionId?: string,
    senderName?: string,
    override?: { apiKey?: string; model?: string; baseUrl?: string }
  ): Promise<{ text: string; usedTools: boolean }> {
    const aiConfig = this.getActiveConfig();
    let baseURL: string | undefined = override?.baseUrl || aiConfig.baseUrl || undefined;
    let apiKey: string = override?.apiKey !== undefined ? override.apiKey : aiConfig.apiKey;
    let defaultModel = 'gpt-4o-mini';

    switch (provider) {
      case 'groq':
        baseURL = baseURL || 'https://api.groq.com/openai/v1';
        defaultModel = 'llama-3.3-70b-versatile';
        break;
      case 'deepseek':
        baseURL = baseURL || 'https://api.deepseek.com';
        defaultModel = 'deepseek-chat';
        break;
      case 'ollama':
        baseURL = baseURL || 'http://localhost:11434/v1';
        apiKey = apiKey || 'ollama'; // Ollama accepts any dummy key
        defaultModel = 'llama3:latest';
        break;
      case 'custom':
        if (!baseURL) {
          throw new Error('AI_BASE_URL wajib diisi jika AI_PROVIDER diset ke custom.');
        }
        defaultModel = 'default';
        break;
      case 'openai':
      default:
        baseURL = baseURL || 'https://api.openai.com/v1';
        defaultModel = 'gpt-4o-mini';
        break;
    }

    if (!apiKey && provider !== 'ollama') {
      throw new Error(`AI_API_KEY belum dikonfigurasi untuk penyedia ${provider}.`);
    }

    const client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL,
    });

    const model = override?.model || aiConfig.model || defaultModel;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Append prior sliding-window conversation turns
    for (const h of history) {
      messages.push({ role: h.role, content: h.content });
    }

    // Append current user prompt
    messages.push({ role: 'user', content: prompt });

    const supportsTools = provider === 'groq' || provider === 'openai';

    const createCompletionWithRecovery = async (params: any): Promise<any> => {
      try {
        return await client.chat.completions.create(params);
      } catch (err: any) {
        const isToolUseFailed =
          err?.status === 400 &&
          (err?.code === 'tool_use_failed' || err?.error?.code === 'tool_use_failed');
        const failedGen = err?.error?.failed_generation;
        if (isToolUseFailed && typeof failedGen === 'string') {
          const funcMatch = failedGen.match(/<function=([^>]+)>([\s\S]*?)<\/function>/);
          if (funcMatch) {
            const funcName = funcMatch[1].trim();
            const body = funcMatch[2];
            const paramMatches = [...body.matchAll(/<parameter=([^>]+)>\n?([\s\S]*?)\n?<\/parameter>/g)];
            const recoveredArgs: Record<string, string> = {};
            for (const m of paramMatches) {
              recoveredArgs[m[1].trim()] = m[2].trim();
            }
            return {
              id: 'recovered-' + Date.now(),
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_rec_' + Math.random().toString(36).substring(2, 9),
                        type: 'function',
                        function: {
                          name: funcName,
                          arguments: JSON.stringify(recoveredArgs),
                        },
                      },
                    ],
                  },
                },
              ],
            };
          }
        }
        throw err;
      }
    };

    let currentCompletion = await createCompletionWithRecovery({
      model,
      messages,
      temperature: 0.7,
      tools: supportsTools ? aiTools : undefined,
      tool_choice: supportsTools ? 'auto' : undefined,
    });

    let iterations = 0;
    const maxIterations = 3;
    let usedTools = false;

    while (iterations < maxIterations) {
      const choice = currentCompletion.choices[0]?.message;
      if (!choice) break;

      // If model provided final text response without new tool calls, return it
      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        return { text: choice.content?.trim() || '', usedTools };
      }

      messages.push(choice);

      for (const toolCall of choice.tool_calls) {
        if (toolCall.type === 'function') {
          usedTools = true;
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch {}

          const result = await executeTool(toolCall.function.name, parsedArgs, {
            sessionId,
            senderNumber: sessionId,
            senderName,
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }
      }

      iterations++;

      // Next iteration allows model to either call another tool or produce final answer
      currentCompletion = await createCompletionWithRecovery({
        model,
        messages,
        temperature: 0.7,
        tools: supportsTools && iterations < maxIterations ? aiTools : undefined,
        tool_choice: supportsTools && iterations < maxIterations ? 'auto' : 'none',
      });
    }

    return {
      text: currentCompletion?.choices[0]?.message?.content?.trim() || '',
      usedTools,
    };
  }
}

export const aiService = new AIService();
