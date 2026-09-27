import { logger } from '../../utils/logger.js';

export interface DiscoveredModel {
  id: string;
  label: string;
  description?: string;
}

export interface ModelDiscoveryResult {
  success: boolean;
  models: DiscoveredModel[];
  source: 'api' | 'preset';
  warning?: string;
}

export const FALLBACK_PROVIDER_PRESETS: Record<string, DiscoveredModel[]> = {
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

/**
 * Dynamically queries official provider APIs for available models, falling back to curated presets
 */
export async function discoverAvailableModels(params: {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<ModelDiscoveryResult> {
  const { provider, apiKey, baseUrl } = params;

  if (!apiKey && provider !== 'ollama' && provider !== 'custom') {
    return {
      success: true,
      models: FALLBACK_PROVIDER_PRESETS[provider] || FALLBACK_PROVIDER_PRESETS.groq,
      source: 'preset',
      warning: 'Kunci API belum diisi. Menampilkan daftar model rekomendasi.',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey || '')}`;
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
    models: FALLBACK_PROVIDER_PRESETS[provider] || FALLBACK_PROVIDER_PRESETS.groq,
    source: 'preset',
  };
}
