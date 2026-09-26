import type { Command } from '../../types/command.js';
import { waClient } from '../../core/whatsapp.js';
import { logger } from '../../utils/logger.js';

const switchCommand: Command = {
  name: 'switch',
  aliases: ['changesession'],
  description: 'Hot-swap active WhatsApp connection to another session profile',
  category: 'automation',
  ownerOnly: true,
  execute: async ({ m, args }) => {
    const targetSession = args[0]?.trim();

    if (!targetSession) {
      await m.reply('Please specify a session profile name.\nExample: `/switch backup_number`');
      return;
    }

    if (targetSession === waClient.getActiveSessionName()) {
      await m.reply(`Session \`${targetSession}\` is already currently active.`);
      return;
    }

    await m.reply(`Switching session to \`${targetSession}\`. Retaining credentials of current session...`);

    setTimeout(async () => {
      try {
        const res = await waClient.switchSession(targetSession);
        logger.info(res, `[Command] Switched session to ${targetSession}`);
      } catch (err: unknown) {
        logger.error({ err }, 'Error switching session via command');
      }
    }, 1000);
  },
};

export default switchCommand;
