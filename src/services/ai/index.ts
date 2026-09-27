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

export { conversationMemory, takeoverManager, messageDebouncer, knowledgeManager, type ChatMessage };

export interface AIOptions {
  systemPrompt?: string;
  maxTokens?: number;
  sessionId?: string;
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
        const res = await this.generateOpenAICompatible(testPrompt, '', provider, [], undefined, {
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
          options?.sessionId
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
