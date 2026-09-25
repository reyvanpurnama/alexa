import type { Command } from '../../types/command.js';

const pingCommand: Command = {
  name: 'ping',
  aliases: ['p'],
  description: 'Check connection latency',
  category: 'general',
  execute: async ({ m }) => {
    const start = Date.now();
    const latency = Date.now() - start;
    await m.reply(`Pong — ${latency}ms`);
  },
};

export default pingCommand;
