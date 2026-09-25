import type { Command } from '../../types/command.js';
import { takeoverManager } from '../../services/ai/index.js';

const unmuteCommand: Command = {
  name: 'unmute',
  aliases: ['resume'],
  description: 'Unmute AI auto-reply and restore autonomous mode',
  category: 'automation',
  ownerOnly: true,
  execute: async ({ m }) => {
    const unmuted = takeoverManager.unmute(m.from);

    if (unmuted) {
      await m.reply('AI auto-reply unmuted. Autonomous mode restored for this chat.');
    } else {
      await m.reply('This chat is not currently muted.');
    }
  },
};

export default unmuteCommand;
