import type { Command } from '../../types/command.js';
import { takeoverManager } from '../../services/ai/index.js';

const muteCommand: Command = {
  name: 'mute',
  aliases: ['pause', 'snooze'],
  description: 'Mute AI auto-reply in this chat for manual handling',
  category: 'automation',
  ownerOnly: true,
  execute: async ({ m, args }) => {
    const minutes = parseInt(args[0] || '30', 10);
    const validMinutes = isNaN(minutes) || minutes <= 0 ? 30 : minutes;

    takeoverManager.mute(m.from, validMinutes, 'owner_command_mute');
    await m.reply(`AI auto-reply muted for this chat for ${validMinutes} minutes.`);
  },
};

export default muteCommand;
