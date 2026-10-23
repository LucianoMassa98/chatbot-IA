const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require('@whiskeysockets/baileys');
const logger = require('../config/logger');

/**
 * Baileys Service — WhatsApp Web alternative integration via QR Code.
 * Optimized for multi-device pairing and reliable connection handling.
 */
class BaileysService {
  constructor() {
    this.sock = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error'
    this.qrString = null;
    this.qrCodeDataUrl = null;
    this.user = null;
    this.lastConnected = null;
    this.authDir = path.resolve(__dirname, '../../sessions/baileys_auth');
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 8;
    this.shouldReconnect = true;
    this.isStarting = false;
    this.messageService = null;
  }

  /**
   * Inject or retrieve messageService lazily to prevent circular dependencies
   */
  getMessageService() {
    if (!this.messageService) {
      this.messageService = require('./messageService');
    }
    return this.messageService;
  }

  /**
   * Safely clean corrupted, empty, or unparseable credentials on disk
   */
  cleanCorruptedAuth() {
    const credsPath = path.join(this.authDir, 'creds.json');
    if (!fs.existsSync(credsPath)) return;

    try {
      const content = fs.readFileSync(credsPath, 'utf8');
      if (!content || !content.trim()) {
        logger.warn('Baileys: creds.json is empty. Cleaning auth directory...');
        fs.rmSync(this.authDir, { recursive: true, force: true });
        return;
      }
      JSON.parse(content);
    } catch (err) {
      logger.warn(`Baileys: creds.json is malformed (${err.message}). Resetting auth directory...`);
      try {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      } catch (rmErr) {
        logger.warn(`Could not clear corrupted auth folder: ${rmErr.message}`);
      }
    }
  }

  /**
   * Check if a valid, registered WhatsApp session exists on disk
   */
  hasSavedSession() {
    const credsPath = path.join(this.authDir, 'creds.json');
    if (!fs.existsSync(credsPath)) return false;

    try {
      const content = fs.readFileSync(credsPath, 'utf8');
      if (!content || !content.trim()) {
        this.cleanCorruptedAuth();
        return false;
      }
      const parsed = JSON.parse(content);
      // Valid session has assigned WhatsApp identity (me.id) or registered flag
      return Boolean(parsed.me?.id || (parsed.registered && parsed.account));
    } catch {
      this.cleanCorruptedAuth();
      return false;
    }
  }

  /**
   * Extract saved user info from creds.json if available
   */
  getUserFromCreds() {
    try {
      const credsPath = path.join(this.authDir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        const parsed = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        if (parsed.me?.id) {
          const phone = parsed.me.id.split(':')[0] || parsed.me.id.split('@')[0];
          return {
            id: parsed.me.id,
            phone,
            name: parsed.me.name || 'Yemas del Sol',
          };
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Get current connection status, QR code, and user info
   */
  getStatus() {
    return {
      status: this.status,
      user: this.user || this.getUserFromCreds(),
      qrCode: this.qrCodeDataUrl,
      lastConnected: this.lastConnected,
      hasSavedSession: this.hasSavedSession(),
    };
  }

  /**
   * Format phone number to WhatsApp JID format
   * @param {string} phone
   */
  formatJid(phone) {
    if (!phone) return null;
    if (phone.includes('@s.whatsapp.net')) return phone;
    const clean = String(phone).replace(/\D/g, '');
    return `${clean}@s.whatsapp.net`;
  }

  /**
   * Initialize or start the WhatsApp Web socket connection
   * @param {boolean} forceFresh - Force clean existing credentials and generate fresh QR
   */
  async startSession(forceFresh = false) {
    if (this.isStarting) {
      logger.info('Baileys: Session startup already in progress...');
      return this.getStatus();
    }

    if (this.sock && this.status === 'connected' && !forceFresh) {
      logger.info('Baileys: Session already connected.');
      return this.getStatus();
    }

    this.isStarting = true;

    try {
      // Clean auth dir only if explicitly forced (fresh QR requested)
      // Otherwise, keep files intact so pairing handshake is not lost across restartRequired (515)
      if (forceFresh) {
        logger.info('Baileys: Fresh QR pairing requested. Clearing previous credentials...');
        try {
          fs.rmSync(this.authDir, { recursive: true, force: true });
        } catch (rmErr) {
          logger.warn(`Could not clear auth folder: ${rmErr.message}`);
        }
      } else {
        this.cleanCorruptedAuth();
      }

      // Ensure directory exists
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      // Clean up previous socket if any
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end(undefined);
          this.sock = null;
        } catch (sockErr) {
          logger.debug(`Previous socket cleanup: ${sockErr.message}`);
        }
      }

      this.status = 'connecting';
      this.shouldReconnect = true;

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      let version = [2, 3000, 1043857760];
      try {
        const fetched = await fetchLatestBaileysVersion();
        if (fetched?.version) version = fetched.version;
      } catch (err) {
        logger.debug(`Could not fetch latest Baileys version: ${err.message}`);
      }

      logger.info(`Baileys initializing with WhatsApp Web version [${version.join('.')}]`);

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        // Standard macOS Desktop browser signature — accepted reliably by WhatsApp servers
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 20000,
        getMessage: async () => ({ conversation: '' }),
      });

      // Save credentials whenever updated
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection updates
      this.sock.ev.on('connection.update', async (update) => {
        const {
          connection, lastDisconnect, qr, isNewLogin,
        } = update;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        logger.info('Baileys connection update:', {
          connection,
          hasQr: Boolean(qr),
          isNewLogin,
          statusCode,
          error: lastDisconnect?.error?.message,
        });

        // 1. QR Code received
        if (qr) {
          logger.info('Baileys: New QR code generated. Ready for scanning on phone.');
          this.qrString = qr;
          this.status = 'qr_ready';
          try {
            this.qrCodeDataUrl = await qrcode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: { dark: '#1e293b', light: '#ffffff' },
            });
          } catch (qrErr) {
            logger.error(`Failed to generate QR data URL: ${qrErr.message}`);
          }
        }

        // 2. Connection open (authenticated & ready)
        if (connection === 'open') {
          this.status = 'connected';
          this.qrString = null;
          this.qrCodeDataUrl = null;
          this.reconnectAttempts = 0;
          this.lastConnected = new Date().toISOString();

          const rawId = this.sock.user?.id || '';
          const phone = rawId.split(':')[0] || rawId.split('@')[0];
          this.user = {
            id: rawId,
            phone,
            name: this.sock.user?.name || this.sock.user?.notify || 'Yemas del Sol',
          };

          logger.info(`✅ WhatsApp Web connected successfully as +${this.user.phone} (${this.user.name})`);
        }

        // 3. Connection closed
        if (connection === 'close') {
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession;
          const isRestartRequired = statusCode === DisconnectReason.restartRequired;

          let reason = 'network';
          if (isLoggedOut) reason = 'loggedOut';
          else if (isRestartRequired) reason = 'restartRequired';
          logger.warn(`Baileys connection closed (status: ${statusCode}, reason: ${reason}).`);

          if (isLoggedOut) {
            logger.warn('Baileys session logged out by user/server. Resetting credentials.');
            this.status = 'disconnected';
            this.user = null;
            this.qrCodeDataUrl = null;
            this.qrString = null;
            if (fs.existsSync(this.authDir)) {
              fs.rmSync(this.authDir, { recursive: true, force: true });
            }
          } else if (isRestartRequired) {
            // Immediate reconnect without backoff penalty — normal after initial QR scan
            logger.info('Baileys: Restart required after initial pairing. Reconnecting immediately...');
            this.status = 'connecting';
            setTimeout(() => {
              this.isStarting = false;
              this.startSession(false);
            }, 1000);
          } else if (this.shouldReconnect) {
            this.status = 'connecting';
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts += 1;
              const delay = Math.min(2500 * this.reconnectAttempts, 12000);
              logger.info(`Reconnecting Baileys in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              setTimeout(() => {
                this.isStarting = false;
                this.startSession(false);
              }, delay);
            } else {
              this.status = 'error';
              logger.error('Max Baileys reconnection attempts reached');
            }
          } else {
            this.status = 'disconnected';
          }
        }
      });

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const m of messages) {
          try {
            if (!m.message || m.key.fromMe) continue;

            const { remoteJid } = m.key;
            if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
              continue;
            }

            const text = m.message.conversation
              || m.message.extendedTextMessage?.text
              || m.message.buttonsResponseMessage?.selectedButtonId
              || m.message.listResponseMessage?.singleSelectReply?.selectedRowId
              || m.message.templateButtonReplyMessage?.selectedId
              || '';

            if (!text.trim()) continue;

            const senderPhone = remoteJid.split('@')[0];
            logger.info(`Baileys received message from ${senderPhone}: "${text.substring(0, 40)}"`);

            const normalizedMessage = {
              userId: senderPhone,
              text: text.trim(),
              channel: 'whatsapp',
              messageType: 'text',
              externalId: m.key.id,
              metadata: {
                provider: 'baileys',
                remoteJid,
                pushName: m.pushName || '',
                timestamp: m.messageTimestamp,
              },
            };

            const svc = this.getMessageService();
            await svc.processIncomingMessage(normalizedMessage);
          } catch (msgErr) {
            logger.error(`Error processing Baileys incoming message: ${msgErr.message}`);
          }
        }
      });

      this.isStarting = false;
      return this.getStatus();
    } catch (error) {
      this.isStarting = false;
      this.status = 'error';
      logger.error(`Failed to start Baileys session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send WhatsApp text message via Baileys socket
   * @param {string} recipientPhone
   * @param {string} text
   */
  async sendMessage(recipientPhone, text) {
    if (!this.sock || this.status !== 'connected') {
      throw new Error('WhatsApp Web (QR) no está conectado actualmente.');
    }

    const jid = this.formatJid(recipientPhone);
    if (!jid) {
      throw new Error(`Número de teléfono inválido: ${recipientPhone}`);
    }

    try {
      const result = await this.sock.sendMessage(jid, { text });
      logger.info(`Message sent via Baileys to ${jid}`);
      return {
        messages: [{ id: result.key?.id }],
        provider: 'baileys',
      };
    } catch (error) {
      logger.error(`Failed to send message via Baileys: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect and logout current session
   */
  async logout() {
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.isStarting = false;

    try {
      if (this.sock) {
        this.sock.ev.removeAllListeners();
        await this.sock.logout().catch(() => {});
        this.sock.end(undefined);
        this.sock = null;
      }
    } catch (err) {
      logger.warn(`Error during Baileys logout: ${err.message}`);
    }

    if (fs.existsSync(this.authDir)) {
      try {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      } catch (rmErr) {
        logger.warn(`Could not clear auth directory: ${rmErr.message}`);
      }
    }

    this.status = 'disconnected';
    this.qrString = null;
    this.qrCodeDataUrl = null;
    this.user = null;

    logger.info('Baileys session logged out and cleaned successfully');
    return this.getStatus();
  }
}

module.exports = new BaileysService();
