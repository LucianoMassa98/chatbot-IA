const logger = require('../../config/logger');
const { Product, Subscription } = require('../../models');
const metaService = require('../metaService');
const env = require('../../config/env');

/**
 * Menu Flow — Menú principal de Yemas del Sol
 * Se activa cuando el usuario está en modo 'idle' o envía cualquier
 * mensaje que no coincide con otro flujo específico.
 */
const menuFlow = {
  name: 'menu',
  description: 'Menú principal de Yemas del Sol con opciones rápidas',

  shouldStart: (message) => {
    const kw = ['hola', 'hello', 'menu', 'menú', 'inicio', 'start', 'hi', 'buenas', 'buen', 'ola'];
    return kw.some((k) => message.toLowerCase().includes(k));
  },

  steps: {
    /**
     * Step 0: Enviar menú principal con botones interactivos
     */
    0: async (userMessage, sessionContext) => {
      return {
        response: buildMainMenuText(),
        nextStep: 1,
        context: {},
        // Señal para que messageService envíe mensaje interactivo con botones
        interactive: buildMainMenuInteractive(),
      };
    },

    /**
     * Step 1: Procesar selección del menú principal
     */
    1: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      // Coincidencia por texto o por ID de botón interactivo
      if (msg.includes('1') || msg.includes('comprar') || msg.includes('producto')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'compra',
        };
      }

      if (msg.includes('2') || msg.includes('suscripci')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'suscripcion',
        };
      }

      if (msg.includes('3') || msg.includes('pedido')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'pedidos',
        };
      }

      if (msg.includes('4') || msg.includes('direcci')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'cambiar_direccion',
        };
      }

      if (msg.includes('5') || msg.includes('reprogramar')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'reprogramar',
        };
      }

      if (msg.includes('6') || msg.includes('operador') || msg.includes('humano') || msg.includes('persona')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'support',
        };
      }

      // Opción no reconocida
      return {
        response:
          'No entendí tu selección. Por favor elegí una opción:\n\n' +
          buildMainMenuText(),
        nextStep: 1,
        context: {},
        interactive: buildMainMenuInteractive(),
      };
    },
  },
};

function buildMainMenuText() {
  return (
    '🐔 *Yemas del Sol* — ¿En qué puedo ayudarte?\n\n' +
    '1️⃣ Comprar maples de huevos\n' +
    '2️⃣ Ver planes de suscripción\n' +
    '3️⃣ Consultar mis pedidos\n' +
    '4️⃣ Cambiar dirección de entrega\n' +
    '5️⃣ Reprogramar una entrega\n' +
    '6️⃣ Hablar con un operador\n\n' +
    '_Respondé con el número o el nombre de la opción._'
  );
}

function buildMainMenuInteractive() {
  return {
    type: 'button',
    body: { text: '🐔 *Yemas del Sol* — ¿En qué puedo ayudarte?' },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'compra', title: '🛒 Comprar maples' } },
        { type: 'reply', reply: { id: 'suscripcion', title: '📦 Suscripciones' } },
        { type: 'reply', reply: { id: 'pedidos', title: '📋 Mis pedidos' } },
      ],
    },
  };
}

module.exports = menuFlow;
