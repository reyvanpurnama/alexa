import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type { Command, CommandContext, RoleResolution, RoleResolver } from '../types/command.js';
import type { SerializedMessage } from './serializer.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { settingsManager } from '../config/settingsManager.js';

class CommandManager {
  private commands = new Map<string, Command>();
  private customCommands = new Map<string, Command>();
  private aliases = new Map<string, string>();
  private isLoaded = false;
  private roleResolver: RoleResolver | null = null;

  /**
   * Registers a custom role resolver callback for RBAC role classification
   */
  setRoleResolver(resolver: RoleResolver): void {
    this.roleResolver = resolver;
    logger.info('[CommandManager] Custom roleResolver registered');
  }

  getRoleResolver(): RoleResolver | null {
    return this.roleResolver;
  }

  /**
   * Resolves the role and metadata for a given sender number and message
   */
  async resolveRole(senderNumber: string, m: SerializedMessage): Promise<RoleResolution> {
    if (this.roleResolver) {
      try {
        const res = await this.roleResolver(senderNumber, m);
        if (typeof res === 'string') {
          return { role: res.toUpperCase() };
        }
        return {
          role: (res.role || 'PUBLIC').toUpperCase(),
          data: res.data,
        };
      } catch (err) {
        logger.error({ err, senderNumber }, '[CommandManager] Custom roleResolver failed, falling back');
      }
    }

    // Check dynamic user roles configured via dashboard settings
    const configuredRoles = settingsManager.getUserRoles();
    if (configuredRoles[senderNumber]) {
      const entry = configuredRoles[senderNumber];
      return {
        role: entry.role.toUpperCase(),
        data: { name: entry.name, ...entry.data },
      };
    }

    const isOwner = settingsManager.isOwner(senderNumber) || config.OWNER_NUMBERS.includes(senderNumber) || m.isOwner;
    return { role: isOwner ? 'OWNER' : 'PUBLIC' };
  }

  /**
   * Manually registers a command in-memory (useful for plugins and runtime extensions)
   */
  registerCommand(command: Command): void {
    if (command && typeof command.name === 'string' && typeof command.execute === 'function') {
      const cmdName = command.name.toLowerCase();
      this.customCommands.set(cmdName, command);
      this.commands.set(cmdName, command);

      if (command.aliases && Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          this.aliases.set(alias.toLowerCase(), cmdName);
        }
      }
    }
  }

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

    if (fs.existsSync(commandsDir)) {
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
    } else {
      fs.mkdirSync(commandsDir, { recursive: true });
    }

    // Restore manually/dynamically registered custom commands
    for (const [name, command] of this.customCommands.entries()) {
      this.commands.set(name, command);
      if (command.aliases && Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          this.aliases.set(alias.toLowerCase(), name);
        }
      }
    }

    this.isLoaded = true;
    logger.info(`Loaded ${this.commands.size} commands (${this.aliases.size} aliases)`);
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

    // Resolve user role if not provided in context
    if (!ctx.userRole) {
      const resolution = await this.resolveRole(ctx.m.senderNumber, ctx.m);
      ctx.userRole = resolution.role;
      ctx.roleData = resolution.data;
    }

    const userRole = (ctx.userRole || 'PUBLIC').toUpperCase();

    // Middleware: Owner only check
    if (cmd.ownerOnly && !ctx.m.isOwner && userRole !== 'OWNER' && userRole !== 'EXECUTIVE') {
      await ctx.m.reply('This command is restricted to the bot owner.');
      return true;
    }

    // Middleware: Group only check
    if (cmd.groupOnly && !ctx.m.isGroup) {
      await ctx.m.reply('This command can only be used in groups.');
      return true;
    }

    // Middleware: Private only check
    if (cmd.privateOnly && ctx.m.isGroup) {
      await ctx.m.reply('This command can only be used in direct messages.');
      return true;
    }

    // Middleware: RBAC Role Guard check
    if (cmd.roles && cmd.roles.length > 0) {
      const allowedRoles = cmd.roles.map((r) => r.toUpperCase());
      const isOwner = ctx.m.isOwner || userRole === 'OWNER' || userRole === 'EXECUTIVE';
      const hasPermission =
        allowedRoles.includes(userRole) ||
        (isOwner && (allowedRoles.includes('OWNER') || allowedRoles.includes('EXECUTIVE')));

      if (!hasPermission) {
        logger.warn(
          { command: cmd.name, userRole, allowedRoles, sender: ctx.m.senderNumber },
          '[RBAC] Command access blocked by role guard'
        );
        await ctx.m.reply(`Akses Ditolak: Perintah ini hanya dapat diakses oleh peran: ${cmd.roles.join(', ')}.`);
        return true;
      }
    }

    try {
      await cmd.execute(ctx);
      return true;
    } catch (error) {
      logger.error({ error, command: cmd.name }, 'Error executing command');
      await ctx.m.reply(`Unable to execute \`${config.PREFIX}${cmd.name}\`. Please try again later.`);
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
