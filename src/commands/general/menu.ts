import type { Command } from '../../types/command.js';
import { commandManager } from '../../core/commandManager.js';

const menuCommand: Command = {
  name: 'menu',
  aliases: ['help'],
  description: 'List available commands',
  category: 'general',
  execute: async ({ m, config }) => {
    const allCommands = commandManager.getAllCommands();

    // Group commands by category
    const categories: Record<string, Command[]> = {};
    for (const cmd of allCommands) {
      const rawCat = cmd.category || 'general';
      const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    }

    const lines: string[] = [
      `*${config.BOT_NAME}*`,
      'Available commands.',
      '',
    ];

    for (const [catName, cmds] of Object.entries(categories)) {
      lines.push(`*${catName}*`);
      for (const cmd of cmds) {
        const badge = cmd.ownerOnly ? ' _(owner)_' : '';
        lines.push(`\`${config.PREFIX}${cmd.name}\` — ${cmd.description}${badge}`);
      }
      lines.push('');
    }

    lines.push(`_Use \`${config.PREFIX}\` before any command._`);

    await m.reply(lines.join('\n'));
  },
};

export default menuCommand;
