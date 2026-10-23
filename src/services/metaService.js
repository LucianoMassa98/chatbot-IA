const axios = require('axios');
const logger = require('../config/logger');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Meta Service — Handles communication with WhatsApp Business Cloud API.
 * Instagram and Messenger are not used in Yemas del Sol.
 */
class MetaService {
  constructor() {
    this.accessToken = env.META_ACCESS_TOKEN;
    this.baseURL = 'https://graph.facebook.com/v25.0';
    const tokenSuffix = this.accessToken ? `...${this.accessToken.slice(-10)}` : 'NOT SET';
    logger.info(`MetaService initialized. Token suffix: ${tokenSuffix}`);
  }

  /**
   * Normalize Argentine mobile phone numbers.
   * WhatsApp webhook sends: 5492644758561  (54 + 9 + area + local, 13 digits)
   * Meta sandbox expects:  54264154758561 (54 + area + 15 + local, 14 digits)
   */
  normalizePhone(phone) {
    const str = String(phone).replace(/\D/g, '');
    if (/^549\d{10}$/.test(str)) {
      const withoutNine = `54${str.slice(3)}`;
      const localStart = withoutNine.length - 7;
      const normalized = `${withoutNine.slice(0, localStart)}15${withoutNine.slice(localStart)}`;
      logger.info(`Phone normalized (AR): ${str} → ${normalized}`);
      return normalized;
    }
    return str;
  }

  /**
   * Send a plain text WhatsApp message.
   * @param {string} phoneNumberId - Business phone number ID
   * @param {string} recipientPhone - Recipient's phone number
   * @param {string} message - Message text (supports WhatsApp markdown)
   */
  async sendWhatsAppMessage(phoneNumberId, recipientPhone, message) {
    try {
      const url = `${this.baseURL}/${phoneNumberId}/messages`;
      const normalizedPhone = this.normalizePhone(recipientPhone);

      const payload = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'text',
        text: { body: message },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info(`WhatsApp message sent to ${recipientPhone}`, {
        messageId: response.data.messages?.[0]?.id,
      });

      return response.data;
    } catch (error) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      logger.error(`Failed to send WhatsApp message: ${error.message}`, {
        status: error.response?.status,
        detail,
        phoneNumberId,
        recipientPhone,
      });
      throw new AppError('Failed to send WhatsApp message', 500);
    }
  }

  /**
   * Send an interactive button message on WhatsApp.
   * @param {string} phoneNumberId
   * @param {string} recipientPhone
   * @param {object} interactive - WhatsApp interactive object (type, body, action)
   */
  async sendWhatsAppInteractive(phoneNumberId, recipientPhone, interactive) {
    try {
      const url = `${this.baseURL}/${phoneNumberId}/messages`;
      const normalizedPhone = this.normalizePhone(recipientPhone);

      const payload = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'interactive',
        interactive,
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info(`WhatsApp interactive sent to ${recipientPhone}`, {
        messageId: response.data.messages?.[0]?.id,
      });

      return response.data;
    } catch (error) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      logger.error(`Failed to send WhatsApp interactive: ${error.message}`, { detail });
      // Fallback: caller should handle and send plain text instead
      throw new AppError('Failed to send WhatsApp interactive message', 500);
    }
  }

  /**
   * Generic message sender — WhatsApp only.
   */
  async sendMessage(channel, recipientId, message, additionalParams = {}) {
    if (channel !== 'whatsapp') {
      logger.warn(`Channel "${channel}" is not supported. Only WhatsApp is active.`);
      throw new AppError(`Canal no soportado: ${channel}`, 400);
    }

    const phoneNumberId = additionalParams.phoneNumberId || env.META_PHONE_NUMBER_ID;

    if (additionalParams.interactive) {
      try {
        return await this.sendWhatsAppInteractive(
          phoneNumberId,
          recipientId,
          additionalParams.interactive,
        );
      } catch (interactiveError) {
        logger.warn(`Failed to send interactive WhatsApp message, falling back to plain text: ${interactiveError.message}`);
      }
    }

    return this.sendWhatsAppMessage(
      phoneNumberId,
      recipientId,
      message,
    );
  }
}

module.exports = new MetaService();
