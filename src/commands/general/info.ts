import type { Command } from '../../types/command.js';

const infoCommand: Command = {
  name: 'info',
  aliases: ['botinfo', 'status'],
  description: 'View bot system specifications, uptime, and sender status',
  category: 'general',
  execute: async ({ m, config }) => {
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    const memoryUsageMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const text = [
      `ℹ️ *${config.BOT_NAME.toUpperCase()} SYSTEM INFO*`,
      '',
      `• *Runtime:* Node.js ${process.version}`,
      `• *Memory Used:* ${memoryUsageMb} MB`,
      `• *Uptime:* ${hours}h ${minutes}m ${seconds}s`,
      `• *Prefix:* \`${config.PREFIX}\``,
      `• *User Role:* ${m.isOwner ? '👑 Owner / Admin' : '👤 Regular User'}`,
      `• *Sender:* +${m.senderNumber}`,
    ].join('\n');

    await m.reply(text, { withFooter: true });
  },
};

export default infoCommand;
