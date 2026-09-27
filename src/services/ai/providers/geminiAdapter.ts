import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage } from '../memory.js';

export async function generateGemini(params: {
  prompt: string;
  systemPrompt: string;
  history: ChatMessage[];
  apiKey: string;
  model: string;
}): Promise<string> {
  const { prompt, systemPrompt, history, apiKey, model: modelName } = params;

  if (!apiKey) {
    throw new Error('AI_API_KEY wajib dikonfigurasi untuk provider Gemini.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: modelName || 'gemini-1.5-flash',
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
