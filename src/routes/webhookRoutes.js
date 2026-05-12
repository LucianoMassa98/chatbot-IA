const express = require('express');
const { verifyWebhook, handleWebhookMessage } = require('../controllers/webhookController');
const { validate } = require('../middleware/validation');
const { webhookPayloadSchema, webhookVerificationSchema } = require('../schemas/webhookSchema');

const router = express.Router();

/**
 * POST /webhook/meta
 * Receive messages from Meta APIs
 */
router.post(
  '/meta',
  validate(webhookPayloadSchema, 'body'),
  handleWebhookMessage,
);

/**
 * GET /webhook/meta
 * Verify webhook with Meta (used during webhook setup)
 */
router.get(
  '/meta',
  validate(webhookVerificationSchema, 'query'),
  verifyWebhook,
);

module.exports = router;
