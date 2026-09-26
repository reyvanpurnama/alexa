import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';

export interface FAQItem {
  topic?: string;
  question: string;
  answer: string;
}

export class KnowledgeManager {
  private knowledgeDir = path.join(process.cwd(), 'knowledge');
  private cachedContext: string = '';
  private lastLoadedAt: number = 0;

  constructor() {
    this.reload();
  }

  /**
   * Reloads and re-indexes all knowledge documents from the knowledge/ directory
   */
  reload(): void {
    if (!fs.existsSync(this.knowledgeDir)) {
      fs.mkdirSync(this.knowledgeDir, { recursive: true });
    }

    const sections: string[] = [];

    // 1. Read business.md (or any .md / .txt documents)
    const businessDocPath = path.join(this.knowledgeDir, 'business.md');
    if (fs.existsSync(businessDocPath)) {
      try {
        const content = fs.readFileSync(businessDocPath, 'utf-8').trim();
        if (content) {
          sections.push(`=== Business Profile, Services & Policies ===\n${content}`);
        }
      } catch (err) {
        logger.error({ err }, 'Failed to read business.md in knowledge base');
      }
    }

    // 2. Read faq.json
    const faqPath = path.join(this.knowledgeDir, 'faq.json');
    if (fs.existsSync(faqPath)) {
      try {
        const rawJson = fs.readFileSync(faqPath, 'utf-8');
        const items: FAQItem[] = JSON.parse(rawJson);

        if (Array.isArray(items) && items.length > 0) {
          const formattedFaq = items
            .map((item, idx) => `[FAQ ${idx + 1}] Q: ${item.question}\nA: ${item.answer}`)
            .join('\n\n');

          sections.push(`=== Official Frequently Asked Questions ===\n${formattedFaq}`);
        }
      } catch (err) {
        logger.error({ err }, 'Failed to parse faq.json in knowledge base');
      }
    }

    if (sections.length > 0) {
      this.cachedContext = `[OFFICIAL BUSINESS KNOWLEDGE BASE]\nUse the following verified business facts, pricing, and operating rules to answer inquiries accurately. Do not invent pricing or bank accounts not listed here:\n\n${sections.join('\n\n')}`;
    } else {
      this.cachedContext = '';
    }

    this.lastLoadedAt = Date.now();
    logger.info(`[Knowledge] Loaded business knowledge base (${this.cachedContext.length} chars).`);
  }

  /**
   * Returns formatted knowledge context for system prompt injection
   */
  getKnowledgeContext(): string {
    return this.cachedContext;
  }

  /**
   * Returns inspection metadata for API and debugging
   */
  getStats(): { hasKnowledge: boolean; length: number; lastLoadedAt: number } {
    return {
      hasKnowledge: this.cachedContext.length > 0,
      length: this.cachedContext.length,
      lastLoadedAt: this.lastLoadedAt,
    };
  }
}

export const knowledgeManager = new KnowledgeManager();
