import path from 'path';
import fs from 'fs';
import readline from 'readline';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  type WASocket,
  type AnyMessageContent,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import { config } from '../config/index.js';
import { logger, baileysLogger } from '../utils/logger.js';
import { formatToWhatsAppJid, formatPhoneNumberForPairing } from '../utils/jid.js';
import { messageQueue } from '../queue/messageQueue.js';
import { handleIncomingMessage } from '../handlers/messageHandler.js';

export type WhatsAppStatus =
  | 'INITIALIZING'
  | 'QR_READY'
  | 'PAIRING_READY'
  | 'CONNECTED'
  | 'DISCONNECTED';

export interface SendMediaParams {
  type: 'image' | 'video' | 'audio' | 'document';
  url?: string;
  buffer?: Buffer;
  caption?: string;
  fileName?: string;
  mimetype?: string;
}

export class WhatsAppClient {
  private sock: WASocket | null = null;
  private status: WhatsAppStatus = 'INITIALIZING';
  private qrCode: string | null = null;
  private pairingCode: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isReconnecting = false;
  public user: { id: string; name?: string } | null = null;

  private sessionsDir = path.join(process.cwd(), 'sessions', config.SESSION_NAME);

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
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionsDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    logger.info(`Starting Baileys v${version.join('.')} (Latest: ${isLatest})...`);

    this.sock = makeWASocket({
      version,
      logger: baileysLogger,
      printQRInTerminal: false, // Handled manually for pairing code support
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
    });

    this.sock.ev.on('creds.update', saveCreds);

    // Connection lifecycle
    this.sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCode = qr;
        
        // If pairing code mode is enabled and user is not registered yet
        if (config.USE_PAIRING_CODE && !state.creds.registered) {
          await this.handlePairingFlow();
        } else {
          this.status = 'QR_READY';
          logger.info('📱 Scan the QR Code below with your WhatsApp:');
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'close') {
        this.status = 'DISCONNECTED';
        this.qrCode = null;
        this.user = null;

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const reason = DisconnectReason[statusCode as unknown as keyof typeof DisconnectReason] || statusCode;

        logger.warn(`WhatsApp connection closed. Reason: ${reason} (${statusCode})`);

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        if (isLoggedOut) {
          logger.error('❌ Device was logged out. Please clear session folder and re-scan QR/Pairing.');
          // Clean up session if logged out
          try {
            fs.rmSync(this.sessionsDir, { recursive: true, force: true });
          } catch (e) {
            logger.error({ err: e }, 'Failed to clear session dir');
          }
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

        logger.info(
          `🚀 WhatsApp connected successfully! Account: ${this.user?.name || 'WA Gateway'} (+${this.user?.id})`
        );
      }
    });

    // Inbound messages
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
  async requestPairing(phoneNumber: string): Promise<string> {
    if (!this.sock) {
      throw new Error('WhatsApp client is not initialized');
    }
    const cleanPhone = formatPhoneNumberForPairing(phoneNumber);
    if (!cleanPhone) {
      throw new Error('Invalid phone number for pairing');
    }

    this.status = 'PAIRING_READY';
    const code = await this.sock.requestPairingCode(cleanPhone);
    this.pairingCode = code;

    logger.info('==========================================');
    logger.info(`🔑 WA PAIRING CODE FOR +${cleanPhone}:  ${code}`);
    logger.info('   Enter this 8-digit code on WhatsApp -> Linked Devices -> Link with Phone Number');
    logger.info('==========================================');

    return code;
  }

  private async handlePairingFlow(): Promise<void> {
    if (this.pairingCode) return;

    let phone = config.PAIRING_PHONE_NUMBER;
    if (!phone && process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      phone = await new Promise<string>((resolve) => {
        rl.question('📲 Enter your WhatsApp phone number for Pairing Code (e.g. 628123456789): ', (ans) => {
          rl.close();
          resolve(ans.trim());
        });
      });
    }

    if (phone) {
      try {
        await this.requestPairing(phone);
      } catch (err) {
        logger.error({ err }, 'Failed to generate pairing code');
      }
    } else {
      logger.warn(
        'USE_PAIRING_CODE is enabled, but no phone number provided. Set PAIRING_PHONE_NUMBER in .env or call POST /api/pairing'
      );
    }
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.error('❌ Max reconnect attempts reached. Please check network or restart manually.');
      return;
    }

    const delay = Math.min(3000 * this.reconnectAttempts, 20000);
    logger.info(`🔄 Reconnecting to WhatsApp in ${delay / 1000}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(async () => {
      this.isReconnecting = false;
      try {
        await this.initialize();
      } catch (err) {
        logger.error({ err }, 'Error during reconnect initialization');
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Send a text message
   */
  async sendText(target: string, text: string, options: { queued?: boolean } = { queued: true }) {
    if (!this.isConnected() || !this.sock) {
      throw new Error('WhatsApp is not connected. Current status: ' + this.status);
    }

    const jid = formatToWhatsAppJid(target);

    const task = async () => {
      logger.info(`📤 Sending text message to ${jid}`);
      return await this.sock!.sendMessage(jid, { text });
    };

    if (options.queued) {
      return await messageQueue.add(task);
    } else {
      return await task();
    }
  }

  /**
   * Send media (image, video, document, audio)
   */
  async sendMedia(
    target: string,
    params: SendMediaParams,
    options: { queued?: boolean } = { queued: true }
  ) {
    if (!this.isConnected() || !this.sock) {
      throw new Error('WhatsApp is not connected. Current status: ' + this.status);
    }

    const jid = formatToWhatsAppJid(target);

    let mediaContent: AnyMessageContent;

    const mediaPayload = params.url ? { url: params.url } : params.buffer!;

    switch (params.type) {
      case 'image':
        mediaContent = {
          image: mediaPayload,
          caption: params.caption,
          mimetype: params.mimetype || 'image/jpeg',
        };
        break;
      case 'video':
        mediaContent = {
          video: mediaPayload,
          caption: params.caption,
          mimetype: params.mimetype || 'video/mp4',
        };
        break;
      case 'audio':
        mediaContent = {
          audio: mediaPayload,
          mimetype: params.mimetype || 'audio/mp4',
        };
        break;
      case 'document':
        mediaContent = {
          document: mediaPayload,
          caption: params.caption,
          mimetype: params.mimetype || 'application/pdf',
          fileName: params.fileName || 'document.pdf',
        };
        break;
      default:
        throw new Error(`Unsupported media type: ${params.type}`);
    }

    const task = async () => {
      logger.info(`📤 Sending ${params.type} media to ${jid}`);
      return await this.sock!.sendMessage(jid, mediaContent);
    };

    if (options.queued) {
      return await messageQueue.add(task);
    } else {
      return await task();
    }
  }
}

export const waClient = new WhatsAppClient();
