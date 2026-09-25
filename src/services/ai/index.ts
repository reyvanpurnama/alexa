import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { conversationMemory, type ChatMessage } from './memory.js';

export { conversationMemory, type ChatMessage };

export interface AIOptions {
  systemPrompt?: string;
  maxTokens?: number;
  sessionId?: string;
}

class AIService {
  /**
   * Generates text response using the configured AI provider,
   * with multi-turn conversation memory support if sessionId is provided.
   */
  async generateResponse(prompt: string, options?: AIOptions): Promise<string> {
    const provider = config.AI_PROVIDER;
    const systemPrompt = options?.systemPrompt || config.AI_SYSTEM_PROMPT;
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
        response = await this.generateOpenAICompatible(prompt, systemPrompt, provider, history);
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
   * Universal OpenAI-compatible Implementation (OpenAI, Groq, DeepSeek, Ollama, Custom)
   */
  private async generateOpenAICompatible(
    prompt: string,
    systemPrompt: string,
    provider: 'openai' | 'groq' | 'deepseek' | 'ollama' | 'custom',
    history: ChatMessage[]
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

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content?.trim() || '';
  }
}

export const aiService = new AIService();
