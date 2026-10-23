const logger = require('../config/logger');
const orderService = require('../services/orderService');

/**
 * Mercado Pago Webhook Controller
 *
 * Receives payment notifications from MP, processes them via orderService,
 * and always returns 200 immediately to prevent MP retries.
 */
const handleMercadoPagoWebhook = async (req, res) => {
  // Always ACK immediately
  res.status(200).json({ success: true });

  try {
    const mercadoPagoService = require('../services/mercadoPagoService');
    const { body } = req;

    logger.info('Mercado Pago webhook received', { type: body.type, id: body.data?.id });

    const result = await mercadoPagoService.processWebhook(body);

    if (!result) {
      return; // non-payment notification, nothing to do
    }

    const {
      orderId, mpPaymentId, status, rawData,
    } = result;

    if (!orderId) {
      logger.warn('MP webhook: no external_reference (orderId) found in payment data');
      return;
    }

    await orderService.handlePaymentWebhook(orderId, mpPaymentId, status, rawData);

    logger.info('MP webhook processed successfully', { orderId, mpPaymentId, status });
  } catch (error) {
    // Log but never let errors reach MP (they already got 200)
    logger.error(`MP webhook processing error: ${error.message}`, { stack: error.stack });
  }
};

module.exports = { handleMercadoPagoWebhook };
