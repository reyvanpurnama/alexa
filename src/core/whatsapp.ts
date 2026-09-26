import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { config } from '../config/index.js';
import { logger, baileysLogger } from '../utils/logger.js';
import { formatPhoneNumberForPairing } from '../utils/jid.js';
import { handleIncomingMessage } from '../handlers/messageHandler.js';
import { sessionManager, type SessionProfile } from './sessionManager.js';
import { messageSender, type SendMediaParams } from './messageSender.js';

export type WhatsAppStatus =
  | 'INITIALIZING'
  | 'QR_READY'
  | 'PAIRING_READY'
  | 'CONNECTED'
  | 'DISCONNECTED';

export { type SendMediaParams, type SessionProfile };

export class WhatsAppClient {
  private sock: WASocket | null = null;
  private status: WhatsAppStatus = 'INITIALIZING';
  private qrCode: string | null = null;
  private pairingCode: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isReconnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isExplicitLogout = false;
  public user: { id: string; name?: string } | null = null;

  get sessionsDir(): string {
    return sessionManager.getSessionDir();
  }

  getActiveSessionName(): string {
    return sessionManager.getActiveSessionName();
  }

  getSocket(): WASocket | null {
    return this.sock;
  }

  getStatus(): WhatsAppStatus {
    return this.status;
  }

  getQrCode(): string | null {
    return this.qrCode;
  }

  getPairingCode(): string | null {
    return this.pairingCode;
  }

  isConnected(): boolean {
    return this.status === 'CONNECTED' && this.sock !== null;
  }

  async initialize(): Promise<void> {
    const sessionDir = sessionManager.getSessionDir();
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    logger.info(`Starting Baileys v${version.join('.')} (Latest: ${isLatest})...`);

    this.sock = makeWASocket({
      version,
      logger: baileysLogger,
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
    });

    this.sock.ev.on('creds.update', saveCreds);

    // Connection lifecycle events
    this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCode = qr;

        if (config.USE_PAIRING_CODE && !state.creds.registered) {
          await this.handlePairingFlow();
        } else {
          this.status = 'QR_READY';
          logger.info('Scan QR code in WhatsApp Linked Devices:');
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'close') {
        this.status = 'DISCONNECTED';
        this.qrCode = null;
        this.user = null;

        if (this.isExplicitLogout) {
          logger.info('[WhatsApp] Connection closed due to explicit logout. Reconnect suppressed.');
          return;
        }

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const reason = DisconnectReason[statusCode as unknown as keyof typeof DisconnectReason] || statusCode;

        logger.warn(`Connection closed (${reason}: ${statusCode})`);

        if (statusCode === DisconnectReason.loggedOut) {
          logger.error('Device logged out. Session directory cleared.');
          sessionManager.wipeSession();
        } else {
          this.scheduleReconnect();
        }
      } else if (connection === 'open') {
        this.status = 'CONNECTED';
        this.qrCode = null;
        this.pairingCode = null;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        const authUser = this.sock?.user;
        this.user = authUser
          ? {
              id: authUser.id.split(':')[0],
              name: authUser.name,
            }
          : null;

        logger.info(`Connected as ${this.user?.name || 'Gateway'} (+${this.user?.id})`);
      }
    });

    // Inbound messages dispatcher
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        try {
          if (this.sock) {
            await handleIncomingMessage(this.sock, msg);
          }
        } catch (err) {
          logger.error({ err }, 'Error handling incoming message');
        }
      }
    });
  }

  /**
   * Generates WhatsApp 8-digit pairing code for phone-number based linking
   */
  async requestPairing(phoneNumber: string, sessionName?: string): Promise<string> {
    const cleanPhone = formatPhoneNumberForPairing(phoneNumber);
    if (!cleanPhone) {
      throw new Error('Invalid phone number for pairing');
    }

    if (sessionName && sessionName.trim() && sessionName.trim() !== this.getActiveSessionName()) {
      await this.switchSession(sessionName.trim());
    } else if (this.sock && (this.isConnected() || this.user) && this.user?.id !== cleanPhone) {
      logger.info(
        `[WhatsApp] Current session is linked to +${this.user?.id}. Resetting session for new number +${cleanPhone}...`
      );
      await this.logout();
    }

    if (!this.sock) {
      await this.initialize();
    }

    if (!this.sock) {
      throw new Error('Failed to initialize WhatsApp socket for pairing');
    }

    this.status = 'PAIRING_READY';
    const code = await this.sock.requestPairingCode(cleanPhone);
    this.pairingCode = code;

    logger.info(`Pairing code for +${cleanPhone}: ${code}`);
    return code;
  }

  /**
   * Disconnects active socket and resets credentials for new linking
   */
  async logout(): Promise<void> {
    logger.info('[WhatsApp] Initiating zero-downtime session logout and reset...');
    this.isExplicitLogout = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = 0;

    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (err) {
        logger.debug({ err }, 'Sock logout error, closing stream directly');
        try {
          this.sock.end(undefined);
        } catch {}
      }
      this.sock = null;
    }

    sessionManager.wipeSession();

    this.status = 'DISCONNECTED';
    this.qrCode = null;
    this.pairingCode = null;
    this.user = null;
    this.isExplicitLogout = false;

    logger.info('[WhatsApp] Re-initializing socket for new device linking...');
    await this.initialize();
  }

  /**
   * Session Management Facade
   */
  listSessions(): SessionProfile[] {
    return sessionManager.listSessions();
  }

  deleteSession(sessionName: string): boolean {
    return sessionManager.deleteSession(sessionName);
  }

  async switchSession(sessionName: string): Promise<{
    success: boolean;
    sessionName: string;
    isNew: boolean;
  }> {
    const cleanName = sessionManager.sanitizeSessionName(sessionName);

    if (cleanName === this.getActiveSessionName() && this.isConnected()) {
      return { success: true, sessionName: cleanName, isNew: false };
    }

    logger.info(`[WhatsApp] Hot-swapping session from "${this.getActiveSessionName()}" to "${cleanName}"...`);
    this.isExplicitLogout = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = 0;

    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
    }

    const isNew = !sessionManager.sessionExists(cleanName);
    sessionManager.setActiveSessionName(cleanName);

    this.status = 'INITIALIZING';
    this.qrCode = null;
    this.pairingCode = null;
    this.user = null;
    this.isExplicitLogout = false;

    await this.initialize();

    return {
      success: true,
      sessionName: cleanName,
      isNew,
    };
  }

  /**
   * Outbound Messaging Facade
   */
  async checkNumber(phoneNumber: string) {
    this.ensureConnected();
    return await messageSender.checkNumber(this.sock!, phoneNumber);
  }

  async sendText(target: string, text: string, options: { queued?: boolean } = { queued: true }) {
    this.ensureConnected();
    return await messageSender.sendText(this.sock!, target, text, options);
  }

  async sendMedia(
    target: string,
    params: SendMediaParams,
    options: { queued?: boolean } = { queued: true }
  ) {
    this.ensureConnected();
    return await messageSender.sendMedia(this.sock!, target, params, options);
  }

  private ensureConnected(): void {
    if (!this.isConnected() || !this.sock) {
      throw new Error(`WhatsApp is not connected. Current status: ${this.status}`);
    }
  }

  private async handlePairingFlow(): Promise<void> {
    if (this.pairingCode) return;

    const phone = config.PAIRING_PHONE_NUMBER;
    if (phone) {
      try {
        await this.requestPairing(phone);
      } catch (err) {
        logger.error({ err }, 'Failed to generate pairing code');
      }
    } else {
      this.status = 'PAIRING_READY';
      logger.info(
        `[WhatsApp] Sesi "${this.getActiveSessionName()}" siap untuk dipairing. Minta kode pairing lewat Dashboard (Tab 'Nomor & Sesi') atau API POST /api/pairing`
      );
    }
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached. Please restart manually.');
      return;
    }

    const delay = Math.min(3000 * this.reconnectAttempts, 20000);
    logger.info(`Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.isReconnecting = false;
      try {
        await this.initialize();
      } catch (err) {
        logger.error({ err }, 'Error during reconnect initialization');
        this.scheduleReconnect();
      }
    }, delay);
  }
}

export const waClient = new WhatsAppClient();
