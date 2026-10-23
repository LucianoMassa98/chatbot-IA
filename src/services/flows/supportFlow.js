const logger = require('../../config/logger');

/**
 * Support Flow — Contactar con un operador
 * Marca la conversación como "en espera" y notifica al CRM.
 */
const supportFlow = {
  name: 'support',
  description: 'Conecta al cliente con un operador humano',

  shouldStart: (message) => {
    const kw = ['operador', 'persona', 'humano', 'ayuda', 'soporte', 'problema', 'queja', 'reclamo', 'hablar', 'atenci'];
    return kw.some((k) => message.toLowerCase().includes(k));
  },

  steps: {
    /**
     * Step 0: Confirmar derivación y poner en espera
     */
    0: async (userMessage, sessionContext) => {
      logger.info(`User ${sessionContext.userId} requested operator assistance`);

      return {
        response:
          '👋 Entendido. Un operador estará disponible para atenderte a la brevedad.\n\n'
          + 'Por favor indicanos brevemente el motivo de tu consulta para que puedan ayudarte mejor:',
        nextStep: 1,
        context: { requestedOperator: true },
      };
    },

    /**
     * Step 1: Registrar motivo y marcar como esperando operador
     */
    1: async (userMessage, sessionContext) => {
      logger.info(`Operator assistance reason captured for user ${sessionContext.userId}`, {
        reason: userMessage,
      });

      return {
        response:
          '✅ Recibimos tu consulta. Un operador se comunicará con vos por este mismo chat.\n\n'
          + '⏰ Nuestro horario de atención es de lunes a viernes de 8:00 a 18:00 hs.\n\n'
          + 'Gracias por tu paciencia. 🙏',
        nextStep: null,
        context: {
          operatorReason: userMessage,
          waitingForOperator: true,
        },
        // Signal to messageService to set conversation status to 'waiting'
        setConversationWaiting: true,
        shouldResetFlow: true,
      };
    },
  },
};

module.exports = supportFlow;
