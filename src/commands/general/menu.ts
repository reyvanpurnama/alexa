import type { Command } from '../../types/command.js';
import { commandManager } from '../../core/commandManager.js';

const menuCommand: Command = {
  name: 'menu',
  aliases: ['help', 'start'],
  description: 'Display all available commands and bot features',
  category: 'general',
  execute: async ({ m, config }) => {
    const allCommands = commandManager.getAllCommands();

    // Group commands by category
    const categories: Record<string, Command[]> = {};
    for (const cmd of allCommands) {
      const cat = (cmd.category || 'general').toUpperCase();
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    }

    const lines: string[] = [
      `🤖 *${config.BOT_NAME.toUpperCase()} COMMAND CENTER*`,
      `Prefix: \`${config.PREFIX}\``,
      '',
    ];

    for (const [catName, cmds] of Object.entries(categories)) {
      lines.push(`📂 *${catName}*`);
      for (const cmd of cmds) {
        const aliasText = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
        const badge = cmd.ownerOnly ? ' 👑' : '';
        lines.push(`• \`${config.PREFIX}${cmd.name}\`${aliasText} - ${cmd.description}${badge}`);
      }
      lines.push('');
    }

    lines.push(`💡 _Type \`${config.PREFIX}info\` to view bot details._`);

    await m.reply(lines.join('\n'), { withFooter: true });
  },
};

export default menuCommand;
