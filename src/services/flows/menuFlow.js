const logger = require('../../config/logger');
const { Product, Subscription, User } = require('../../models');
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
     * Si el usuario no está registrado, se inicia el proceso de registro progresivo.
     */
    0: async (userMessage, sessionContext) => {
      const user = await User.findByPk(sessionContext.userId);
      const isRegistered = user && user.firstName && (user.address || user.location);

      if (!isRegistered) {
        if (!user.firstName) {
          return {
            response: 'Para comenzar, necesitamos realizar tu registro. Por favor ingresá tu *nombre y apellido*:',
            nextStep: 2,
            context: {},
          };
        } else {
          return {
            response: `¡Hola, ${user.firstName}! 👋\n\nPara poder enviarte nuestros productos, necesitamos tu dirección de entrega.\n\nPor favor, escribí tu *dirección completa* o compartinos tu *ubicación* (puedes enviar tu ubicación actual de WhatsApp o un enlace de Google Maps) 📍:`,
            nextStep: 3,
            context: {},
          };
        }
      }

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

      // Opción 1 o 2 → suscripciones (compra individual deshabilitada)
      if (msg.includes('1') || msg.includes('comprar') || msg.includes('producto') || msg.includes('compra') ||
          msg.includes('2') || msg.includes('suscripci')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'suscripcion',
        };
      }

      if (msg.includes('3') || msg.includes('2') || msg.includes('pedido')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'pedidos',
        };
      }

      if (msg.includes('4') || msg.includes('3') || msg.includes('direcci')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'cambiar_direccion',
        };
      }

      if (msg.includes('5') || msg.includes('4') || msg.includes('reprogramar')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'reprogramar',
        };
      }

      if (msg.includes('6') || msg.includes('5') || msg.includes('operador') || msg.includes('humano') || msg.includes('persona') || msg.includes('support')) {
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

    /**
     * Step 2: Recibir nombre y solicitar dirección/ubicación
     */
    2: async (userMessage, sessionContext) => {
      const name = userMessage.trim();
      // Ignorar mensajes automáticos o vacíos
      if (!name || name.length < 2 || name.startsWith('[')) {
        return {
          response: 'Por favor, ingresá un nombre y apellido válido (ej. Juan Pérez):',
          nextStep: 2,
          context: {},
        };
      }

      const user = await User.findByPk(sessionContext.userId);
      if (user) {
        await user.update({ firstName: name });
      }

      return {
        response: `¡Un gusto conocerte, *${name}*! 👋\n\nAhora, por favor ingresá tu *dirección de entrega* o compartinos tu *ubicación* (puedes enviar tu ubicación actual de WhatsApp o un enlace de Google Maps) 📍:`,
        nextStep: 3,
        context: {},
      };
    },

    /**
     * Step 3: Recibir dirección/ubicación y mostrar menú principal
     */
    3: async (userMessage, sessionContext) => {
      const addressOrLocation = userMessage.trim();
      if (!addressOrLocation || addressOrLocation.length < 5 || addressOrLocation.startsWith('[')) {
        return {
          response: 'Por favor, ingresá una dirección válida o compartinos tu ubicación 📍:',
          nextStep: 3,
          context: {},
        };
      }

      const user = await User.findByPk(sessionContext.userId);
      if (user) {
        const isMapUrl = addressOrLocation.includes('maps.google.com') ||
          addressOrLocation.includes('maps.app.goo.gl') ||
          addressOrLocation.includes('goo.gl/maps');

        if (isMapUrl) {
          await user.update({
            location: { googleMapsUrl: addressOrLocation },
            address: 'Ubicación de Google Maps'
          });
        } else {
          await user.update({
            address: addressOrLocation
          });
        }
      }

      return {
        response: `¡Registro completado con éxito! 🎉\n\n` + buildMainMenuText(),
        nextStep: 1,
        context: {},
        interactive: buildMainMenuInteractive(),
      };
    },
  },
};

function buildMainMenuText() {
  return (
    'Seleccioná una opción:\n\n' +
    '1️⃣ Ver planes de suscripción\n' +
    '2️⃣ Consultar mis pedidos\n' +
    '3️⃣ Cambiar dirección de entrega\n' +
    '4️⃣ Reprogramar una entrega\n' +
    '5️⃣ Hablar con un operador\n\n' +
    '_Respondé con el número o el nombre de la opción._'
  );
}

function buildMainMenuInteractive() {
  return {
    type: 'list',
    header: {
      type: 'text',
      text: '🐔 Yemas del Sol'
    },
    body: {
      text: '¿En qué puedo ayudarte hoy? Seleccioná una opción del menú:'
    },
    footer: {
      text: 'Yemas del Sol AI'
    },
    action: {
      button: 'Ver Opciones',
      sections: [
        {
          title: 'Menú Principal',
          rows: [
            { id: 'suscripcion', title: '📦 Suscripciones', description: 'Ver y contratar planes mensuales de maples' },
            { id: 'pedidos', title: '📋 Mis pedidos', description: 'Consultar el estado de tus pedidos' },
            { id: 'cambiar_direccion', title: '📍 Cambiar dirección', description: 'Modificar tu dirección de entrega' },
            { id: 'reprogramar', title: '⏰ Reprogramar entrega', description: 'Cambiar fecha u hora de entrega' },
            { id: 'support', title: '💬 Hablar con operador', description: 'Contactar con atención al cliente' }
          ]
        }
      ]
    }
  };
}

module.exports = menuFlow;
