const express = require('express');

const router = express.Router();
const { authMiddleware, roleGuard } = require('../middleware/authMiddleware');
const integrations = require('../controllers/integrationsController');

// All integration endpoints require operator or admin authentication
router.use(authMiddleware);

// Overview of all integrations
router.get('/', integrations.getAllIntegrations);

// WhatsApp Integrations & QR linking
router.get('/whatsapp/status', integrations.getWhatsAppStatus);
router.post('/whatsapp/start', integrations.startWhatsAppQR);
router.post('/whatsapp/disconnect', integrations.disconnectWhatsAppQR);
router.post('/whatsapp/provider', integrations.setWhatsAppProvider);
router.post('/whatsapp/test', integrations.sendTestWhatsAppMessage);

// AI Configuration (Admin only)
router.post('/ai/config', roleGuard('administrador'), integrations.updateAIConfig);
router.post('/ai/test', integrations.testAIResponse);

module.exports = router;
