import type { Command } from '../../types/command.js';
import { conversationMemory } from '../../services/ai/index.js';

const resetCommand: Command = {
  name: 'reset',
  aliases: ['clear', 'resetai', 'clearchat'],
  description: 'Reset your AI conversation context and memory',
  category: 'ai',
  execute: async ({ m }) => {
    const sessionId = m.isGroup ? `${m.from}:${m.senderNumber}` : m.senderNumber;
    const cleared = conversationMemory.clearHistory(sessionId);

    if (cleared) {
      await m.reply('Conversation memory reset. Starting a fresh session.');
    } else {
      await m.reply('No active conversation session found.');
    }
  },
};

export default resetCommand;
