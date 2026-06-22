const axios = require('axios');
const logger = require('../config/logger');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Meta Service - Handles communication with Meta APIs
 */
class MetaService {
  constructor() {
    this.accessToken = env.META_ACCESS_TOKEN;
    this.baseURL = 'https://graph.facebook.com/v22.0';
    // Log last 10 chars of token to verify correct token is loaded (safe to log)
    const tokenSuffix = this.accessToken ? `...${this.accessToken.slice(-10)}` : 'NOT SET';
    logger.info(`MetaService initialized. Token suffix: ${tokenSuffix}`);
  }


  /**
   * Send WhatsApp message
   */
  async sendWhatsAppMessage(phoneNumberId, recipientPhone, message) {
    try {
      const url = `${this.baseURL}/${phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'text',
        text: {
          body: message,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info(`WhatsApp message sent to ${recipientPhone}`, {
        messageId: response.data.messages[0].id,
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
   * Send Facebook Messenger message
   */
  async sendMessengerMessage(recipientId, message) {
    try {
      const url = `${this.baseURL}/${recipientId}/messages`;

      const payload = {
        messaging_type: 'RESPONSE',
        recipient: {
          id: recipientId,
        },
        message: {
          text: message,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          access_token: this.accessToken,
        },
      });

      logger.info(`Messenger message sent to ${recipientId}`, {
        messageId: response.data.message_id,
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to send Messenger message: ${error.message}`);
      throw new AppError('Failed to send Messenger message', 500);
    }
  }

  /**
   * Send Instagram DM message
   */
  async sendInstagramMessage(recipientId, message) {
    try {
      const url = `${this.baseURL}/${recipientId}/messages`;

      const payload = {
        recipient: {
          id: recipientId,
        },
        message: {
          text: message,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info(`Instagram message sent to ${recipientId}`, {
        messageId: response.data.message_id,
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to send Instagram message: ${error.message}`);
      throw new AppError('Failed to send Instagram message', 500);
    }
  }

  /**
   * Generic message sender based on channel
   */
  async sendMessage(channel, recipientId, message, additionalParams = {}) {
    switch (channel) {
      case 'whatsapp':
        return this.sendWhatsAppMessage(
          additionalParams.phoneNumberId,
          recipientId,
          message,
        );
      case 'messenger':
        return this.sendMessengerMessage(recipientId, message);
      case 'instagram':
        return this.sendInstagramMessage(recipientId, message);
      default:
        throw new AppError(`Unsupported channel: ${channel}`, 400);
    }
  }
}

module.exports = new MetaService();
