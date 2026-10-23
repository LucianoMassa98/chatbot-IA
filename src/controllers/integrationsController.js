const logger = require('../config/logger');
const env = require('../config/env');
const whatsappGateway = require('../services/whatsappGateway');
const baileysService = require('../services/baileysService');
const aiService = require('../services/aiService');

/**
 * Integrations Controller
 * Manages WhatsApp (QR/Meta), Mercado Pago, and Gemini AI integrations from the CRM Frontend.
 */

/**
 * GET /api/integrations
 * Overview of all system integrations
 */
const getAllIntegrations = async (req, res) => {
  try {
    const whatsapp = whatsappGateway.getIntegrationStatus();

    const mercadopago = {
      configured: Boolean(env.MP_ACCESS_TOKEN && env.MP_PUBLIC_KEY),
      publicKey: env.MP_PUBLIC_KEY ? `${env.MP_PUBLIC_KEY.slice(0, 14)}...` : 'No configurado',
      hasAccessToken: Boolean(env.MP_ACCESS_TOKEN),
      webhookSecretConfigured: Boolean(env.MP_WEBHOOK_SECRET),
      webhookUrl: `${env.APP_URL}/webhook/mercadopago`,
      successUrl: env.MP_SUCCESS_URL,
      failureUrl: env.MP_FAILURE_URL,
      pendingUrl: env.MP_PENDING_URL,
    };

    const ai = {
      enabled: env.AI_ENABLED,
      configured: Boolean(env.AI_API_KEY),
      model: env.AI_MODEL || 'gemini-2.0-flash',
      hasApiKey: Boolean(env.AI_API_KEY),
      systemPrompt: env.AI_SYSTEM_PROMPT || '',
    };

    res.json({
      success: true,
      data: {
        whatsapp,
        mercadopago,
        ai,
      },
    });
  } catch (error) {
    logger.error(`Get integrations error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/integrations/whatsapp/status
 * Real-time WhatsApp status and QR Code
 */
const getWhatsAppStatus = async (req, res) => {
  try {
    const status = whatsappGateway.getIntegrationStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error(`Get WhatsApp status error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations/whatsapp/start
 * Start or regenerate WhatsApp Web QR session
 */
const startWhatsAppQR = async (req, res) => {
  try {
    const { forceFresh } = req.body || {};
    logger.info(`Starting Baileys session (forceFresh=${Boolean(forceFresh)})`);

    const status = await baileysService.startSession(Boolean(forceFresh));
    res.json({
      success: true,
      message: 'Sesión iniciada. Esperando escaneo de código QR.',
      data: {
        ...status,
        activeProvider: whatsappGateway.provider,
        effectiveProvider: whatsappGateway.getEffectiveProvider(),
      },
    });
  } catch (error) {
    logger.error(`Start WhatsApp QR error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations/whatsapp/disconnect
 * Disconnect and remove saved WhatsApp Web session
 */
const disconnectWhatsAppQR = async (req, res) => {
  try {
    const status = await baileysService.logout();
    res.json({
      success: true,
      message: 'Sesión de WhatsApp Web desconectada exitosamente.',
      data: status,
    });
  } catch (error) {
    logger.error(`Disconnect WhatsApp QR error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations/whatsapp/provider
 * Switch active WhatsApp provider mode ('auto' | 'baileys' | 'meta')
 */
const setWhatsAppProvider = async (req, res) => {
  try {
    const { provider } = req.body;
    if (!provider || !['auto', 'baileys', 'meta'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Proveedor inválido. Opciones: "auto", "baileys", "meta".',
      });
    }

    const updated = whatsappGateway.setProvider(provider);
    res.json({
      success: true,
      message: `Proveedor cambiado a ${provider}.`,
      data: updated,
    });
  } catch (error) {
    logger.error(`Set WhatsApp provider error: ${error.message}`);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations/whatsapp/test
 * Send a test WhatsApp message to verify connection
 */
const sendTestWhatsAppMessage = async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        message: 'Destinatario (to) y mensaje son requeridos.',
      });
    }

    const result = await whatsappGateway.sendMessage(to, message);
    res.json({
      success: true,
      message: 'Mensaje de prueba enviado con éxito.',
      data: result,
    });
  } catch (error) {
    logger.error(`Send test WhatsApp message error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations/ai/config
 * Update Gemini AI configuration
 */
const updateAIConfig = async (req, res) => {
  try {
    const {
      enabled, model, systemPrompt, apiKey,
    } = req.body;

    if (enabled !== undefined) env.AI_ENABLED = Boolean(enabled);
    if (model) env.AI_MODEL = model;
    if (systemPrompt !== undefined) env.AI_SYSTEM_PROMPT = systemPrompt;
    if (apiKey) env.AI_API_KEY = apiKey;

    // Reinitialize AI client if needed
    if (env.AI_ENABLED && env.AI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        aiService.client = new GoogleGenerativeAI(env.AI_API_KEY);
        aiService.model = aiService.client.getGenerativeModel({
          model: env.AI_MODEL,
          systemInstruction: env.AI_SYSTEM_PROMPT,
        });
      } catch (aiErr) {
        logger.warn(`Could not reinitialize AI model: ${aiErr.message}`);
      }
    }

    res.json({
      success: true,
      message: 'Configuración de IA actualizada.',
      data: {
        enabled: env.AI_ENABLED,
        model: env.AI_MODEL,
        systemPrompt: env.AI_SYSTEM_PROMPT,
        hasApiKey: Boolean(env.AI_API_KEY),
      },
    });
  } catch (error) {
    logger.error(`Update AI config error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/integrations/ai/test
 * Test AI response with a prompt
 */
const testAIResponse = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, message: 'Prompt es requerido.' });
    }

    const response = await aiService.generateResponse(prompt);
    res.json({
      success: true,
      data: {
        prompt,
        response,
      },
    });
  } catch (error) {
    logger.error(`Test AI response error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllIntegrations,
  getWhatsAppStatus,
  startWhatsAppQR,
  disconnectWhatsAppQR,
  setWhatsAppProvider,
  sendTestWhatsAppMessage,
  updateAIConfig,
  testAIResponse,
};
