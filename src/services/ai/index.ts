import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../../config/index.js';
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

class AIService {
  /**
   * Generates text response using the configured AI provider,
   * grounded with business knowledge base, dynamic SQLite schema, multi-turn memory, and autonomous tool calling.
   */
  async generateResponse(prompt: string, options?: AIOptions): Promise<string> {
    const provider = config.AI_PROVIDER;
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

    let response = '';

    switch (provider) {
      case 'gemini':
        response = await this.generateGemini(prompt, systemPrompt, history);
        break;

      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'ollama':
      case 'custom':
        response = await this.generateOpenAICompatible(
          prompt,
          systemPrompt,
          provider,
          history,
          options?.sessionId
        );
        break;

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    if (options?.sessionId && response) {
      conversationMemory.addMessage(options.sessionId, 'user', prompt);
      conversationMemory.addMessage(options.sessionId, 'assistant', response);
    }

    return response;
  }

  /**
   * Google Gemini Implementation with chat history support
   */
  private async generateGemini(
    prompt: string,
    systemPrompt: string,
    history: ChatMessage[]
  ): Promise<string> {
    const apiKey = config.AI_API_KEY;
    if (!apiKey) {
      throw new Error('AI_API_KEY is not set in .env for Gemini provider.');
    }

    const modelName = config.AI_MODEL || 'gemini-1.5-flash';
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
    sessionId?: string
  ): Promise<string> {
    let baseURL: string | undefined = config.AI_BASE_URL || undefined;
    let apiKey: string = config.AI_API_KEY;
    let defaultModel = 'gpt-4o-mini';

    switch (provider) {
      case 'groq':
        baseURL = baseURL || 'https://api.groq.com/openai/v1';
        defaultModel = 'openai/gpt-oss-120b';
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
          throw new Error('AI_BASE_URL is required when AI_PROVIDER is set to custom.');
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
      throw new Error(`AI_API_KEY is not set in .env for ${provider} provider.`);
    }

    const client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL,
    });

    const model = config.AI_MODEL || defaultModel;

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

    let currentCompletion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      tools: supportsTools ? aiTools : undefined,
      tool_choice: supportsTools ? 'auto' : undefined,
    });

    let iterations = 0;
    const maxIterations = 3;

    while (iterations < maxIterations) {
      const choice = currentCompletion.choices[0]?.message;
      if (!choice) break;

      // If model provided final text response without new tool calls, return it
      if (!choice.tool_calls || choice.tool_calls.length === 0) {
        return choice.content?.trim() || '';
      }

      messages.push(choice);

      for (const toolCall of choice.tool_calls) {
        if (toolCall.type === 'function') {
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
      currentCompletion = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        tools: supportsTools && iterations < maxIterations ? aiTools : undefined,
        tool_choice: supportsTools && iterations < maxIterations ? 'auto' : 'none',
      });
    }

    return currentCompletion.choices[0]?.message?.content?.trim() || '';
  }
}

export const aiService = new AIService();
