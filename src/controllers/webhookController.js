const logger = require('../config/logger');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const messageService = require('../services/messageService');
const { normalizeMessage } = require('../utils/messageNormalizer');

/**
 * Webhook Controller - Handles incoming Meta webhooks
 */

/**
 * Verify webhook (GET request for webhook setup)
 */
const verifyWebhook = (req, res, next) => {
  try {
    const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': verifyToken } = req.query;

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      return next(new AppError('Invalid webhook verification parameters', 400));
    }

    if (verifyToken !== env.META_VERIFY_TOKEN) {
      logger.warn('Invalid webhook verify token attempted');
      return next(new AppError('Invalid verify token', 403));
    }

    logger.info('Webhook verified successfully');
    res.status(200).send(challenge);
  } catch (error) {
    logger.error(`Webhook verification error: ${error.message}`);
    next(error);
  }
};

/**
 * Handle incoming webhook messages (POST request)
 */
const handleWebhookMessage = async (req, res, next) => {
  try {
    const { object, entry } = req.body;

    logger.info('Webhook received', {
      object,
      entryCount: entry ? entry.length : 0,
    });

    // Validate payload structure
    if (!object || !entry || !Array.isArray(entry)) {
      return res.status(200).json({ success: false, message: 'Invalid payload' });
    }

    // Process each entry
    for (const entryItem of entry) {
      if (!entryItem.changes || !Array.isArray(entryItem.changes)) {
        continue;
      }

      for (const change of entryItem.changes) {
        const { value, field } = change;

        // Determine messaging product
        let messagingProduct = null;
        if (object === 'whatsapp_business_account') {
          messagingProduct = 'whatsapp';
        } else if (object === 'page') {
          messagingProduct = value.messaging_product || 'facebook';
        } else if (object === 'instagram') {
          messagingProduct = 'instagram';
        }

        // Process messages
        if (value.messages && Array.isArray(value.messages)) {
          for (const message of value.messages) {
            try {
              // Normalize the message
              const normalizedMessage = normalizeMessage(value, messagingProduct);

              // Process the message
              const result = await messageService.processIncomingMessage(normalizedMessage);

              // Send response
              if (result.response) {
                // TODO: Send response through Meta API
                // This will be handled by the messageService.sendMessage method
                logger.info('Message processed successfully', {
                  userId: result.userId,
                  channel: result.channel,
                });
              }
            } catch (messageError) {
              logger.error(`Failed to process message: ${messageError.message}`);
              // Continue processing other messages
            }
          }
        }

        // Process status updates
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            logger.info('Message status update', {
              messageId: status.id,
              status: status.status,
            });
          }
        }
      }
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Webhook message handling error: ${error.message}`);
    // Still return 200 to acknowledge receipt and prevent Meta retries
    res.status(200).json({ success: false, message: error.message });
  }
};

module.exports = {
  verifyWebhook,
  handleWebhookMessage,
};
