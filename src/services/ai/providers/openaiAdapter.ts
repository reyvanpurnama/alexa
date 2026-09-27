import OpenAI from 'openai';
import { aiTools, executeTool } from '../tools.js';
import type { ChatMessage } from '../memory.js';

export interface OpenAIAdapterParams {
  prompt: string;
  systemPrompt: string;
  provider: 'openai' | 'groq' | 'deepseek' | 'ollama' | 'custom';
  history: ChatMessage[];
  sessionId?: string;
  senderName?: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export async function generateOpenAICompatible(
  params: OpenAIAdapterParams
): Promise<{ text: string; usedTools: boolean }> {
  const {
    prompt,
    systemPrompt,
    provider,
    history,
    sessionId,
    senderName,
    apiKey,
    model: configuredModel,
    baseUrl: customBaseUrl,
  } = params;

  let baseURL: string | undefined = customBaseUrl || undefined;
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

  const effectiveKey = apiKey || (provider === 'ollama' ? 'ollama' : '');
  if (!effectiveKey) {
    throw new Error(`AI_API_KEY belum dikonfigurasi untuk penyedia ${provider}.`);
  }

  const client = new OpenAI({
    apiKey: effectiveKey,
    baseURL,
  });

  const model = configuredModel || defaultModel;

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

  const createCompletionWithRecovery = async (completionParams: any): Promise<any> => {
    try {
      return await client.chat.completions.create(completionParams);
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
