const logger = require('../../config/logger');
const metaService = require('../metaService');
const env = require('../../config/env');

/**
 * Flow ID del template nativo de WhatsApp para registro de clientes
 * Configurado en Meta Business Manager
 */
const REGISTRO_CLIENTE_FLOW_ID = '1343679341024620';

/**
 * Envía el WhatsApp Flow nativo de registro_cliente al usuario
 * @param {string} phoneNumberId - ID del número de WhatsApp Business
 * @param {string} recipientPhone - Número de teléfono del destinatario
 */
async function sendRegistroClienteFlow(phoneNumberId, recipientPhone) {
  const normalizedPhone = metaService.normalizePhone(recipientPhone);
  const url = `${metaService.baseURL}/${phoneNumberId}/messages`;

  // flow_token must be unique per message and must not contain special chars
  const flowToken = `reg${Date.now()}`;

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'interactive',
    interactive: {
      type: 'flow',
      body: {
        text: 'Para brindarte una mejor atención, necesitamos registrar tus datos. Por favor completá el formulario a continuación.',
      },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowToken,
          flow_id: REGISTRO_CLIENTE_FLOW_ID,
          flow_cta: 'Registrarme',
          flow_action: 'navigate',
          flow_action_payload: {
            screen: 'REGISTRO',
          },
        },
      },
    },
  };

  const axios = require('axios');
  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${metaService.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    logger.info(`WhatsApp Flow registro_cliente enviado a ${recipientPhone}`, {
      flowId: REGISTRO_CLIENTE_FLOW_ID,
      messageId: response.data?.messages?.[0]?.id,
    });

    return response.data;
  } catch (error) {
    // Log full API error detail for diagnosis
    const apiError = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    logger.error(`Meta API error sending registro_cliente flow: ${apiError}`, {
      status: error.response?.status,
      phoneNumberId,
      recipientPhone: normalizedPhone,
      flowId: REGISTRO_CLIENTE_FLOW_ID,
    });
    throw error;
  }
}

/**
 * Registro Cliente Flow Handler
 * Se activa automáticamente cuando el usuario es nuevo
 */
const registroClienteFlow = {
  name: 'registro_cliente',
  description: 'Flow de registro enviado automáticamente a nuevos clientes via WhatsApp Flow nativo',
  flowId: REGISTRO_CLIENTE_FLOW_ID,

  /**
   * No necesita shouldStart porque se dispara desde messageService
   * cuando se detecta que el usuario es nuevo
   */
  shouldStart: () => false,

  /**
   * Función para enviar el flow nativo de WhatsApp al nuevo usuario
   */
  sendToNewUser: sendRegistroClienteFlow,

  /**
   * Flow steps (fallback de texto si el Flow nativo falla)
   */
  steps: {
    /**
     * Step 0: Mensaje de bienvenida con el flow nativo
     * Si el canal no es WhatsApp, usa texto plano
     */
    0: async (userMessage, sessionContext) => ({
      response:
          '¡Hola! 👋 Bienvenido/a. Somos nuevos juntos y nos gustaría conocerte mejor.\n\n'
          + 'Por favor, completá el formulario de registro que te enviamos para poder brindarte una atención personalizada.',
      nextStep: null,
      context: {
        isNewUser: true,
        registrationSent: true,
      },
      shouldResetFlow: true,
    }),
  },
};

module.exports = registroClienteFlow;
