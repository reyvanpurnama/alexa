import type { Command } from '../../types/command.js';
import { commandManager } from '../../core/commandManager.js';

const menuCommand: Command = {
  name: 'menu',
  aliases: ['help'],
  description: 'List available commands',
  category: 'general',
  execute: async ({ m, config, userRole }) => {
    const allCommands = commandManager.getAllCommands();
    const role = (userRole || 'PUBLIC').toUpperCase();
    const isOwner = m.isOwner || role === 'OWNER' || role === 'EXECUTIVE';

    // Group commands by category (filtering out hidden, unauthorized owner commands, and unauthorized role commands)
    const categories: Record<string, Command[]> = {};
    for (const cmd of allCommands) {
      if (cmd.hidden) continue;
      if (cmd.ownerOnly && !isOwner) continue;

      if (cmd.roles && cmd.roles.length > 0) {
        const allowedRoles = cmd.roles.map((r) => r.toUpperCase());
        const hasPermission =
          allowedRoles.includes(role) ||
          (isOwner && (allowedRoles.includes('OWNER') || allowedRoles.includes('EXECUTIVE')));
        if (!hasPermission) continue;
      }

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
        const badge = cmd.ownerOnly
          ? ' _(owner)_'
          : cmd.roles && cmd.roles.length > 0
          ? ` _(${cmd.roles.map((r) => r.toLowerCase()).join(', ')})_`
          : '';
        lines.push(`\`${config.PREFIX}${cmd.name}\` — ${cmd.description}${badge}`);
      }
      lines.push('');
    }

    lines.push(`_Use \`${config.PREFIX}\` before any command._`);

    await m.reply(lines.join('\n'));
  },
};

export default menuCommand;
