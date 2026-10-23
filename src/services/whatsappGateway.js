const logger = require('../config/logger');
const env = require('../config/env');
const metaService = require('./metaService');
const baileysService = require('./baileysService');

/**
 * WhatsApp Gateway
 * Unified orchestrator that bridges Meta Cloud API and WhatsApp Web (QR code / Baileys).
 */
class WhatsAppGateway {
  constructor() {
    // 'auto' | 'baileys' | 'meta'
    this.provider = process.env.WHATSAPP_PROVIDER || 'auto';
    logger.info(`WhatsAppGateway initialized with provider mode: ${this.provider}`);
  }

  /**
   * Determine which provider to use for sending messages
   */
  getEffectiveProvider() {
    if (this.provider === 'baileys') return 'baileys';
    if (this.provider === 'meta') return 'meta';

    // In 'auto' mode: favor Baileys if connected, otherwise fallback to Meta
    if (baileysService.status === 'connected') {
      return 'baileys';
    }

    if (env.META_ACCESS_TOKEN && env.META_PHONE_NUMBER_ID) {
      return 'meta';
    }

    return 'baileys';
  }

  /**
   * Set active provider mode
   * @param {'auto'|'baileys'|'meta'} provider
   */
  setProvider(provider) {
    if (!['auto', 'baileys', 'meta'].includes(provider)) {
      throw new Error('Proveedor inválido. Debe ser "auto", "baileys" o "meta".');
    }
    this.provider = provider;
    logger.info(`WhatsApp provider mode updated to: ${this.provider}`);
    return this.getIntegrationStatus();
  }

  /**
   * Send WhatsApp text message using the active provider
   * @param {string} to - Recipient phone number
   * @param {string} text - Message content
   * @param {object} options - Channel options (e.g. interactive payload for Meta)
   */
  async sendMessage(to, text, options = {}) {
    const effective = this.getEffectiveProvider();
    logger.info(`Sending WhatsApp message via [${effective}] to ${to}`);

    if (effective === 'baileys') {
      if (baileysService.status === 'connected') {
        return baileysService.sendMessage(to, text);
      }
      // If Baileys was explicitly chosen or auto-fell-back but isn't connected
      if (this.provider === 'auto' && env.META_ACCESS_TOKEN) {
        logger.warn('Baileys not connected in auto mode, falling back to Meta Cloud API');
        return metaService.sendMessage('whatsapp', to, text, options);
      }
      throw new Error('WhatsApp Web (QR) no está conectado. Por favor escaneá el código QR en el CRM.');
    }

    // Meta API path
    return metaService.sendMessage('whatsapp', to, text, options);
  }

  /**
   * Get full WhatsApp status for CRM frontend
   */
  getIntegrationStatus() {
    const baileysStatus = baileysService.getStatus();
    const metaConfigured = Boolean(env.META_ACCESS_TOKEN && env.META_PHONE_NUMBER_ID);

    return {
      activeProvider: this.provider,
      effectiveProvider: this.getEffectiveProvider(),
      baileys: baileysStatus,
      meta: {
        configured: metaConfigured,
        phoneNumberId: env.META_PHONE_NUMBER_ID || '',
        verifyToken: env.META_VERIFY_TOKEN || '',
        hasAccessToken: Boolean(env.META_ACCESS_TOKEN),
        webhookUrl: `${env.APP_URL}/webhook/meta`,
      },
    };
  }
}

module.exports = new WhatsAppGateway();
