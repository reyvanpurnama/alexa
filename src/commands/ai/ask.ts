import type { Command } from '../../types/command.js';
import { aiService } from '../../services/ai/index.js';
import { logger } from '../../utils/logger.js';

const askCommand: Command = {
  name: 'ai',
  aliases: ['ask', 'tanya'],
  description: 'Ask the AI assistant a question',
  category: 'ai',
  execute: async ({ m, text, config }) => {
    const question = text.trim();
    if (!question) {
      await m.reply(`Please provide a question.\nExample: \`${config.PREFIX}ai explain quantum computing in one sentence\``);
      return;
    }

    try {
      const answer = await aiService.generateResponse(question);
      await m.reply(answer);
    } catch (error) {
      logger.error({ error }, 'Error generating AI response');
      await m.reply('AI service is currently unavailable. Please ensure AI_API_KEY is configured.');
    }
  },
};

export default askCommand;
