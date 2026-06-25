const axios = require('axios');
const logger = require('../config/logger');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Mercado Pago Service
 * Handles payment preference creation and webhook processing.
 * All orders must remain in pending_payment until MP confirms via webhook.
 */
class MercadoPagoService {
  constructor() {
    this.accessToken = env.MP_ACCESS_TOKEN;
    this.baseURL = 'https://api.mercadopago.com';
    this.webhookSecret = env.MP_WEBHOOK_SECRET;
  }

  /**
   * Create a payment preference and return the checkout URL.
   * @param {object} order - Order record from DB
   * @param {object} user  - User record from DB
   * @param {string} itemTitle - Human-readable item name
   * @returns {{ preferenceId, paymentLink }}
   */
  async createPreference(order, user, itemTitle) {
    try {
      const body = {
        items: [
          {
            id: order.id,
            title: itemTitle,
            quantity: order.quantity,
            unit_price: Number(order.total) / order.quantity,
            currency_id: 'ARS',
          },
        ],
        payer: {
          name: user.firstName || '',
          surname: user.lastName || '',
          phone: { number: user.contact },
        },
        back_urls: {
          success: env.MP_SUCCESS_URL || `${env.APP_URL}/payment/success`,
          failure: env.MP_FAILURE_URL || `${env.APP_URL}/payment/failure`,
          pending: env.MP_PENDING_URL || `${env.APP_URL}/payment/pending`,
        },
        auto_return: 'approved',
        external_reference: order.id,
        notification_url: `${env.APP_URL}/webhook/mercadopago`,
        statement_descriptor: 'Yemas del Sol',
      };

      const response = await axios.post(
        `${this.baseURL}/checkout/preferences`,
        body,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const { id: preferenceId, init_point: paymentLink } = response.data;

      logger.info('Mercado Pago preference created', { preferenceId, orderId: order.id });

      return { preferenceId, paymentLink };
    } catch (error) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      logger.error(`Failed to create MP preference: ${detail}`);
      throw new AppError('No se pudo generar el link de pago. Intentá de nuevo.', 500);
    }
  }

  /**
   * Query the current status of a payment from MP.
   * @param {string} paymentId - Mercado Pago payment ID
   * @returns {object} MP payment data
   */
  async getPaymentStatus(paymentId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/v1/payments/${paymentId}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );
      return response.data;
    } catch (error) {
      logger.error(`Failed to get MP payment status: ${error.message}`);
      throw new AppError('No se pudo consultar el estado del pago.', 500);
    }
  }

  /**
   * Process a Mercado Pago webhook notification.
   * Returns the internal payment status ('approved'|'pending'|'rejected'|'cancelled').
   * @param {object} body - Raw webhook body from MP
   * @returns {{ orderId: string, mpPaymentId: string, status: string } | null}
   */
  async processWebhook(body) {
    try {
      const { type, data } = body;

      // Only handle payment notifications
      if (type !== 'payment' || !data?.id) {
        logger.info('MP webhook: non-payment notification, skipping', { type });
        return null;
      }

      const mpPaymentId = String(data.id);
      const paymentData = await this.getPaymentStatus(mpPaymentId);

      const statusMap = {
        approved: 'approved',
        in_process: 'pending',
        pending: 'pending',
        rejected: 'rejected',
        cancelled: 'cancelled',
        refunded: 'cancelled',
        charged_back: 'cancelled',
      };

      const status = statusMap[paymentData.status] || 'pending';
      const orderId = paymentData.external_reference;

      logger.info('MP webhook processed', { mpPaymentId, orderId, status });

      return { orderId, mpPaymentId, status, rawData: paymentData };
    } catch (error) {
      logger.error(`Failed to process MP webhook: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new MercadoPagoService();
