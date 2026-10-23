const express = require('express');

const router = express.Router();
const { handleMercadoPagoWebhook } = require('../controllers/mercadoPagoController');

/**
 * POST /webhook/mercadopago
 * Receives payment notifications from Mercado Pago.
 * Must return 200 immediately — processing is async.
 */
router.post('/mercadopago', handleMercadoPagoWebhook);

module.exports = router;
