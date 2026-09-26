import type { Command } from '../../types/command.js';
import { knowledgeManager } from '../../services/ai/index.js';

const reloadKbCommand: Command = {
  name: 'reloadkb',
  aliases: ['refreshkb', 'loadkb'],
  description: 'Reload business knowledge documents from knowledge/ directory',
  category: 'automation',
  ownerOnly: true,
  execute: async ({ m }) => {
    knowledgeManager.reload();
    const stats = knowledgeManager.getStats();

    await m.reply(
      `Business knowledge base reloaded successfully.\nActive context length: ${stats.length} characters.`
    );
  },
};

export default reloadKbCommand;
