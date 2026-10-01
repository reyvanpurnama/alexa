import type { WASocket } from '@whiskeysockets/baileys';
import type { SerializedMessage } from '../../core/serializer.js';
import { logger } from '../../utils/logger.js';
import { settingsManager } from '../../config/settingsManager.js';
import { config } from '../../config/index.js';
import { generateGemini } from './providers/geminiAdapter.js';
import { generateOpenAICompatible } from './providers/openaiAdapter.js';

export interface IntentParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface IntentContext {
  sock: WASocket;
  m: SerializedMessage;
  role: string;
  roleData?: Record<string, any>;
  params: Record<string, any>;
  rawPrompt: string;
}

export interface IntentResult {
  handled: boolean;
  intentName?: string;
  response?: string;
  withFooter?: boolean;
  tier?: 'tier1_pattern' | 'tier2_llm' | 'custom';
  latencyMs?: number;
  data?: any;
}

export interface IntentDefinition {
  name: string;
  description: string;
  roles: string[]; // Allowed roles (e.g. ['EXECUTIVE'], ['SUPPLIER'], or ['*'] for all)
  patterns?: (RegExp | string)[]; // Fast regex or substring patterns (Tier 1: 0 tokens, <1ms)
  parameters?: Record<string, IntentParamDef>;
  handler: (ctx: IntentContext) => Promise<IntentResult | string | void>;
}

export interface IntentRouteOptions {
  prompt: string;
  role: string;
  roleData?: Record<string, any>;
  m: SerializedMessage;
  sock: WASocket;
}

export type CustomIntentClassifier = (
  prompt: string,
  role: string,
  candidateIntents: IntentDefinition[]
) => Promise<{ intent: string; params: Record<string, any> } | null>;

export class SlimIntentRouter {
  private intents = new Map<string, IntentDefinition>();
  private customClassifier: CustomIntentClassifier | null = null;

  /**
   * Registers a single intent definition
   */
  registerIntent(def: IntentDefinition): void {
    if (!def.name || typeof def.handler !== 'function') {
      throw new Error('[IntentRouter] Invalid intent definition: name and handler are required');
    }
    this.intents.set(def.name.toLowerCase(), def);
    logger.debug({ intent: def.name, roles: def.roles }, '[IntentRouter] Registered intent');
  }

  /**
   * Registers multiple intent definitions at once
   */
  registerIntents(defs: IntentDefinition[]): void {
    for (const def of defs) {
      this.registerIntent(def);
    }
  }

  /**
   * Removes an intent from the registry
   */
  unregisterIntent(name: string): boolean {
    return this.intents.delete(name.toLowerCase());
  }

  getIntent(name: string): IntentDefinition | undefined {
    return this.intents.get(name.toLowerCase());
  }

  getAllIntents(): IntentDefinition[] {
    return Array.from(this.intents.values());
  }

  /**
   * Returns all intents accessible to a specific role
   */
  getIntentsForRole(role: string): IntentDefinition[] {
    const targetRole = (role || 'PUBLIC').toUpperCase();
    const isSuperAdmin = targetRole === 'OWNER' || targetRole === 'EXECUTIVE';

    return Array.from(this.intents.values()).filter((intent) => {
      if (intent.roles.includes('*')) return true;
      const normalizedRoles = intent.roles.map((r) => r.toUpperCase());
      if (normalizedRoles.includes(targetRole)) return true;
      if (isSuperAdmin && (normalizedRoles.includes('OWNER') || normalizedRoles.includes('EXECUTIVE'))) {
        return true;
      }
      return false;
    });
  }

  /**
   * Sets an optional custom classifier (e.g. for external microservice or test mocks)
   */
  setCustomClassifier(classifier: CustomIntentClassifier | null): void {
    this.customClassifier = classifier;
  }

  /**
   * Central route method: tries Tier 1 (Pattern) then Tier 2 (Slim LLM)
   */
  async route(options: IntentRouteOptions): Promise<IntentResult> {
    const startTime = Date.now();
    const { prompt, role, roleData, m, sock } = options;
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      return { handled: false };
    }

    const candidateIntents = this.getIntentsForRole(role);
    if (candidateIntents.length === 0) {
      logger.debug({ role }, '[IntentRouter] No candidate intents configured for role');
      return { handled: false };
    }

    // ─────────────────────────────────────────────────────────────
    // Tier 1: Fast Deterministic Regex / Pattern Matching (0 Tokens)
    // ─────────────────────────────────────────────────────────────
    for (const intent of candidateIntents) {
      if (!intent.patterns || intent.patterns.length === 0) continue;

      for (const pattern of intent.patterns) {
        let matched = false;
        const extractedParams: Record<string, any> = {};

        if (pattern instanceof RegExp) {
          const match = pattern.exec(cleanPrompt);
          if (match) {
            matched = true;
            if (match.groups) {
              Object.assign(extractedParams, match.groups);
            }
          }
        } else if (typeof pattern === 'string') {
          if (cleanPrompt.toLowerCase().includes(pattern.toLowerCase())) {
            matched = true;
          }
        }

        if (matched) {
          // Automatic period normalizer for common queries (e.g. hari ini, bulan ini)
          if (intent.parameters?.period && !extractedParams.period) {
            extractedParams.period = this.extractPeriod(cleanPrompt);
          }

          logger.info(
            { intent: intent.name, role, pattern: String(pattern) },
            '[IntentRouter] Tier 1 Pattern Matched (0 tokens)'
          );

          try {
            const ctx: IntentContext = {
              sock,
              m,
              role,
              roleData,
              params: extractedParams,
              rawPrompt: cleanPrompt,
            };

            const handlerResult = await intent.handler(ctx);
            const latencyMs = Date.now() - startTime;

            if (typeof handlerResult === 'string') {
              return {
                handled: true,
                intentName: intent.name,
                response: handlerResult,
                tier: 'tier1_pattern',
                latencyMs,
              };
            }

            if (handlerResult && typeof handlerResult === 'object') {
              return {
                handled: handlerResult.handled !== false,
                intentName: intent.name,
                response: handlerResult.response,
                withFooter: handlerResult.withFooter,
                tier: 'tier1_pattern',
                latencyMs,
                data: handlerResult.data,
              };
            }

            return {
              handled: true,
              intentName: intent.name,
              tier: 'tier1_pattern',
              latencyMs,
            };
          } catch (err) {
            logger.error({ err, intent: intent.name }, '[IntentRouter] Error executing Tier 1 intent handler');
            return { handled: false };
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Custom Classifier Hook (if registered)
    // ─────────────────────────────────────────────────────────────
    if (this.customClassifier) {
      try {
        const customMatch = await this.customClassifier(cleanPrompt, role, candidateIntents);
        if (customMatch && customMatch.intent && customMatch.intent !== 'none') {
          const targetIntent = candidateIntents.find(
            (i) => i.name.toLowerCase() === customMatch.intent.toLowerCase()
          );
          if (targetIntent) {
            const ctx: IntentContext = {
              sock,
              m,
              role,
              roleData,
              params: customMatch.params || {},
              rawPrompt: cleanPrompt,
            };
            const handlerResult = await targetIntent.handler(ctx);
            const latencyMs = Date.now() - startTime;
            return {
              handled: true,
              intentName: targetIntent.name,
              response: typeof handlerResult === 'string' ? handlerResult : handlerResult?.response,
              withFooter: typeof handlerResult === 'object' ? handlerResult?.withFooter : false,
              tier: 'custom',
              latencyMs,
            };
          }
        }
      } catch (err) {
        logger.warn({ err }, '[IntentRouter] Custom classifier threw error');
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Tier 2: Slim LLM Classifier (~300 Tokens, <1.5s)
    // ─────────────────────────────────────────────────────────────
    try {
      const llmMatch = await this.classifyWithSlimLLM(cleanPrompt, role, candidateIntents);
      if (llmMatch && llmMatch.intent && llmMatch.intent !== 'none') {
        const targetIntent = candidateIntents.find(
          (i) => i.name.toLowerCase() === llmMatch.intent.toLowerCase()
        );

        if (targetIntent) {
          logger.info(
            { intent: targetIntent.name, role, params: llmMatch.params },
            '[IntentRouter] Tier 2 Slim LLM Matched'
          );

          const ctx: IntentContext = {
            sock,
            m,
            role,
            roleData,
            params: llmMatch.params || {},
            rawPrompt: cleanPrompt,
          };

          const handlerResult = await targetIntent.handler(ctx);
          const latencyMs = Date.now() - startTime;

          if (typeof handlerResult === 'string') {
            return {
              handled: true,
              intentName: targetIntent.name,
              response: handlerResult,
              tier: 'tier2_llm',
              latencyMs,
            };
          }

          if (handlerResult && typeof handlerResult === 'object') {
            return {
              handled: handlerResult.handled !== false,
              intentName: targetIntent.name,
              response: handlerResult.response,
              withFooter: handlerResult.withFooter,
              tier: 'tier2_llm',
              latencyMs,
              data: handlerResult.data,
            };
          }

          return {
            handled: true,
            intentName: targetIntent.name,
            tier: 'tier2_llm',
            latencyMs,
          };
        }
      }
    } catch (err) {
      logger.warn({ err }, '[IntentRouter] Tier 2 Slim LLM classifier error');
    }

    // ─────────────────────────────────────────────────────────────
    // Tier 3: Fallback (Unmatched -> standard full AI chat)
    // ─────────────────────────────────────────────────────────────
    return { handled: false };
  }

  /**
   * Ultra-lightweight intent classification prompt (~150 input tokens)
   */
  private async classifyWithSlimLLM(
    prompt: string,
    role: string,
    candidateIntents: IntentDefinition[]
  ): Promise<{ intent: string; params: Record<string, any> } | null> {
    const s = settingsManager.getSettings();
    const provider = s.aiProvider || config.AI_PROVIDER;
    const apiKey = s.aiApiKey !== undefined && s.aiApiKey !== '' ? s.aiApiKey : config.AI_API_KEY;
    const model = s.aiModel !== undefined && s.aiModel !== '' ? s.aiModel : config.AI_MODEL;
    const baseUrl = s.aiBaseUrl !== undefined && s.aiBaseUrl !== '' ? s.aiBaseUrl : config.AI_BASE_URL;

    if (!apiKey && provider !== 'ollama') {
      return null;
    }

    const intentListLines = candidateIntents.map((i) => {
      let paramStr = '';
      if (i.parameters) {
        paramStr = ' | params: ' + Object.entries(i.parameters)
          .map(([k, v]) => `${k} (${v.type}${v.enum ? `: ${v.enum.join('|')}` : ''})`)
          .join(', ');
      }
      return `- "${i.name}": ${i.description}${paramStr}`;
    });

    const systemPrompt = `You are a high-speed intent router.
Role: ${role}
Available intents:
${intentListLines.join('\n')}

Output JSON ONLY:
{"intent": "intent_name", "params": {"param_name": "value"}}
If user message does NOT clearly match any listed intent, reply:
{"intent": "none"}`;

    const userPrompt = `Classify this message: "${prompt}"`;

    let rawReply = '';
    if (provider === 'gemini') {
      rawReply = await generateGemini({
        prompt: userPrompt,
        systemPrompt,
        history: [],
        apiKey,
        model,
      });
    } else {
      const res = await generateOpenAICompatible({
        prompt: userPrompt,
        systemPrompt,
        provider,
        history: [],
        apiKey,
        model,
        baseUrl,
        disableTools: true,
        temperature: 0.1,
        maxTokens: 120,
        responseFormat: { type: 'json_object' },
      });
      rawReply = res.text;
    }

    if (!rawReply) return null;

    try {
      const cleanJson = rawReply
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleanJson);
      return {
        intent: String(parsed.intent || 'none').trim(),
        params: typeof parsed.params === 'object' && parsed.params !== null ? parsed.params : {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Helper to normalize common Indonesian timeframe keywords
   */
  private extractPeriod(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('hari ini') || lower.includes('sekarang')) return 'today';
    if (lower.includes('kemarin')) return 'yesterday';
    if (lower.includes('minggu ini')) return 'this_week';
    if (lower.includes('bulan ini') || lower.includes('sebulan')) return 'this_month';
    if (lower.includes('tahun ini')) return 'this_year';
    return 'today';
  }
}

export const intentRouter = new SlimIntentRouter();
