import type { Command } from '../../types/command.js';
import { waClient } from '../../core/whatsapp.js';
import { logger } from '../../utils/logger.js';

const logoutCommand: Command = {
  name: 'logout',
  aliases: ['disconnect', 'unbind'],
  description: 'Disconnect WhatsApp session and prepare server for new pairing',
  category: 'automation',
  ownerOnly: true,
  execute: async ({ m }) => {
    await m.reply('Session disconnected and cleared. Server is now ready to pair a new phone number.');

    // Small delay to ensure the acknowledgement reply is delivered before socket termination
    setTimeout(() => {
      waClient.logout().catch((err) => {
        logger.error({ err }, 'Error during logout command');
      });
    }, 1000);
  },
};

export default logoutCommand;
