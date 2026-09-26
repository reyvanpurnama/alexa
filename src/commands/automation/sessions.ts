import type { Command } from '../../types/command.js';
import { waClient } from '../../core/whatsapp.js';

const sessionsCommand: Command = {
  name: 'sessions',
  aliases: ['sessionlist', 'profiles'],
  description: 'List saved WhatsApp session profiles on the server',
  category: 'automation',
  ownerOnly: true,
  execute: async ({ m }) => {
    const list = waClient.listSessions();

    if (list.length === 0) {
      await m.reply('No saved session profiles found on disk.');
      return;
    }

    const lines: string[] = [
      '*Session Profiles*',
      `Active: \`${waClient.getActiveSessionName()}\``,
      '',
    ];

    for (const session of list) {
      const activeMark = session.isActive ? ' *(active)*' : '';
      const regStatus = session.registered
        ? `+${session.phoneNumber || 'registered'}`
        : 'unpaired';

      lines.push(`• \`${session.name}\`: ${regStatus}${activeMark}`);
    }

    lines.push('');
    lines.push('Use `/switch <name>` to hot-swap to another profile.');

    await m.reply(lines.join('\n'));
  },
};

export default sessionsCommand;
