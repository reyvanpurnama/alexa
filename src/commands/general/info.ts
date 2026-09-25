import type { Command } from '../../types/command.js';

const infoCommand: Command = {
  name: 'info',
  aliases: ['status'],
  description: 'View system information and status',
  category: 'general',
  execute: async ({ m, config }) => {
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    const memoryUsageMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const text = [
      '*System Status*',
      '',
      `*Bot:* ${config.BOT_NAME}`,
      `*Runtime:* Node.js ${process.version}`,
      `*Memory:* ${memoryUsageMb} MB`,
      `*Uptime:* ${hours}h ${minutes}m ${seconds}s`,
      `*Role:* ${m.isOwner ? 'Owner' : 'User'}`,
      `*Sender:* +${m.senderNumber}`,
    ].join('\n');

    await m.reply(text);
  },
};

export default infoCommand;
