import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export interface AIOptions {
  systemPrompt?: string;
  maxTokens?: number;
}

class AIService {
  /**
   * Generates text response using the configured AI provider
   */
  async generateResponse(prompt: string, options?: AIOptions): Promise<string> {
    const provider = config.AI_PROVIDER;
    const systemPrompt = options?.systemPrompt || config.AI_SYSTEM_PROMPT;

    switch (provider) {
      case 'gemini':
        return await this.generateGemini(prompt, systemPrompt);

      case 'openai':
      case 'groq':
      case 'deepseek':
      case 'ollama':
      case 'custom':
        return await this.generateOpenAICompatible(prompt, systemPrompt, provider);

      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * Google Gemini Implementation
   */
  private async generateGemini(prompt: string, systemPrompt: string): Promise<string> {
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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  }

  /**
   * Universal OpenAI-compatible Implementation (OpenAI, Groq, DeepSeek, Ollama, Custom)
   */
  private async generateOpenAICompatible(
    prompt: string,
    systemPrompt: string,
    provider: 'openai' | 'groq' | 'deepseek' | 'ollama' | 'custom'
  ): Promise<string> {
    let baseURL: string | undefined = config.AI_BASE_URL || undefined;
    let apiKey: string = config.AI_API_KEY;
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
