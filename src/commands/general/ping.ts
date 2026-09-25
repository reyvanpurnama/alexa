import type { Command } from '../../types/command.js';

const pingCommand: Command = {
  name: 'ping',
  aliases: ['p', 'speed'],
  description: 'Check bot responsiveness and latency',
  category: 'general',
  execute: async ({ m, config }) => {
    const start = Date.now();
    await m.react('🏓');
    const latency = Date.now() - start;

    await m.reply(
      `🏓 *Pong!*\n• Bot: *${config.BOT_NAME}*\n• Speed: *${latency}ms*`,
      { withFooter: true }
    );
  },
};

export default pingCommand;
