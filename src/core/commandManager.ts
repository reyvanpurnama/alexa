import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type { Command, CommandContext } from '../types/command.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

class CommandManager {
  private commands = new Map<string, Command>();
  private aliases = new Map<string, string>();
  private isLoaded = false;

  /**
   * Scans and dynamically imports all command files from src/commands (or dist/commands)
   */
  async loadCommands(): Promise<void> {
    this.commands.clear();
    this.aliases.clear();

    // Determine the base commands directory (src or dist depending on execution mode)
    const isCompiled = import.meta.url.includes('/dist/');
    const commandsDir = path.resolve(
      process.cwd(),
      isCompiled ? 'dist/commands' : 'src/commands'
    );

    if (!fs.existsSync(commandsDir)) {
      fs.mkdirSync(commandsDir, { recursive: true });
      this.isLoaded = true;
      return;
    }

    const commandFiles = this.getFilesRecursively(commandsDir).filter((file) => {
      const isTsOrJs = file.endsWith('.ts') || file.endsWith('.js');
      const isDecl = file.endsWith('.d.ts') || file.endsWith('.map');
      return isTsOrJs && !isDecl;
    });

    for (const filePath of commandFiles) {
      try {
        const fileUrl = pathToFileURL(filePath).href;
        const module = await import(fileUrl);
        const command: Command = module.default || module.command;

        if (command && typeof command.name === 'string' && typeof command.execute === 'function') {
          const cmdName = command.name.toLowerCase();
          this.commands.set(cmdName, command);

          if (command.aliases && Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
              this.aliases.set(alias.toLowerCase(), cmdName);
            }
          }
        }
      } catch (err) {
        logger.error({ err, file: filePath }, 'Failed to load command file');
      }
    }

    this.isLoaded = true;
    logger.info(`🧩 Loaded ${this.commands.size} commands (${this.aliases.size} aliases) successfully`);
  }

  getCommand(name: string): Command | undefined {
    const cleanName = name.toLowerCase();
    const resolvedName = this.aliases.get(cleanName) || cleanName;
    return this.commands.get(resolvedName);
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Executes a command with built-in permission and environment checks
   */
  async execute(ctx: CommandContext): Promise<boolean> {
    if (!this.isLoaded) {
      await this.loadCommands();
    }

    const cmd = this.getCommand(ctx.m.command);
    if (!cmd) return false;

    // Middleware: Owner only check
    if (cmd.ownerOnly && !ctx.m.isOwner) {
      await ctx.m.reply('⛔ *Access Denied:* This command is restricted to the bot owner.');
      return true;
    }

    // Middleware: Group only check
    if (cmd.groupOnly && !ctx.m.isGroup) {
      await ctx.m.reply('⚠️ This command can only be used inside a group.');
      return true;
    }

    // Middleware: Private only check
    if (cmd.privateOnly && ctx.m.isGroup) {
      await ctx.m.reply('⚠️ This command can only be used in private chat.');
      return true;
    }

    try {
      await cmd.execute(ctx);
      return true;
    } catch (error) {
      logger.error({ error, command: cmd.name }, 'Error executing command');
      await ctx.m.reply(`❌ An error occurred while executing \`${config.PREFIX}${cmd.name}\`.`);
      return true;
    }
  }

  private getFilesRecursively(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.getFilesRecursively(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}

export const commandManager = new CommandManager();
