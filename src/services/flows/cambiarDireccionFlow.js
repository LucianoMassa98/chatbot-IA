const { Op } = require('sequelize');
const logger = require('../../config/logger');
const { User, Order } = require('../../models');

/**
 * Cambiar Dirección Flow — Permite al usuario actualizar su dirección de entrega
 * Se activa desde el menú principal (opción 4) o por keywords.
 */
const cambiarDireccionFlow = {
  name: 'cambiar_direccion',
  description: 'Flujo para cambiar la dirección de entrega del usuario',

  shouldStart: (message) => {
    const kw = ['direccion', 'dirección', 'cambiar dirección', 'nueva dirección', 'domicilio', 'ubicación', 'ubicacion'];
    return kw.some((k) => message.toLowerCase().includes(k));
  },

  steps: {
    /**
     * Step 0: Mostrar dirección actual y solicitar nueva dirección
     */
    0: async (userMessage, sessionContext) => {
      const user = await User.findByPk(sessionContext.userId);

      if (!user) {
        return {
          response: '❌ No se encontró tu cuenta. Por favor escribí *MENU* para volver al inicio.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      const currentAddress = user.address || 'No registrada';
      const hasMapUrl = user.location && user.location.googleMapsUrl;
      const locationInfo = hasMapUrl
        ? `\n📎 Ubicación guardada: ${user.location.googleMapsUrl}`
        : '';

      return {
        response:
          '📍 *Tu dirección actual:*\n'
          + `${currentAddress}${locationInfo}\n\n`
          + 'Ingresá tu *nueva dirección de entrega* o compartinos tu *ubicación* de WhatsApp / enlace de Google Maps 📍\n\n'
          + '_Escribí *CANCELAR* para volver al menú._',
        nextStep: 1,
        context: { previousAddress: currentAddress },
      };
    },

    /**
     * Step 1: Recibir nueva dirección y pedir confirmación
     */
    1: async (userMessage, sessionContext) => {
      const msg = userMessage.trim();

      // Cancelar
      if (msg.toLowerCase().includes('cancelar') || msg.toLowerCase().includes('menu') || msg.toLowerCase().includes('menú')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'menu',
        };
      }

      // Validar input
      if (!msg || msg.length < 5) {
        return {
          response: 'Por favor, ingresá una dirección válida (mínimo 5 caracteres) o compartí tu ubicación 📍:',
          nextStep: 1,
          context: sessionContext.context,
        };
      }

      const isMapUrl = msg.includes('maps.google.com')
                       || msg.includes('maps.app.goo.gl')
                       || msg.includes('goo.gl/maps');

      const displayAddress = isMapUrl ? '📎 Ubicación de Google Maps' : msg;
      const previousAddress = sessionContext.context.previousAddress || 'No registrada';

      return {
        response:
          '📋 *Confirmá el cambio de dirección:*\n\n'
          + `📍 Anterior: ${previousAddress}\n`
          + `📍 Nueva: ${displayAddress}\n\n`
          + '¿Confirmás el cambio? Respondé *SÍ* o *NO*.',
        nextStep: 2,
        context: {
          ...sessionContext.context,
          newAddress: msg,
          isMapUrl,
        },
      };
    },

    /**
     * Step 2: Confirmar y actualizar dirección
     */
    2: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      // Cancelar
      if (msg.includes('no') || msg.includes('cancelar')) {
        return {
          response: '❌ Cambio de dirección cancelado. Tu dirección sigue siendo la misma.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'menu',
        };
      }

      // Validar confirmación
      if (!msg.includes('si') && !msg.includes('sí') && !msg.includes('ok') && !msg.includes('confirmo')) {
        return {
          response: 'Respondé *SÍ* para confirmar o *NO* para cancelar.',
          nextStep: 2,
          context: sessionContext.context,
        };
      }

      try {
        const { newAddress, isMapUrl } = sessionContext.context;
        const user = await User.findByPk(sessionContext.userId);

        if (!user) {
          return {
            response: '❌ Error al actualizar. Por favor intentá de nuevo o hablá con un operador.',
            nextStep: null,
            context: {},
            shouldResetFlow: true,
          };
        }

        // Actualizar dirección del usuario
        if (isMapUrl) {
          await user.update({
            location: { googleMapsUrl: newAddress },
            address: 'Ubicación de Google Maps',
          });
        } else {
          await user.update({
            address: newAddress,
          });
        }

        // Actualizar dirección en pedidos activos que aún no fueron despachados
        const displayAddress = isMapUrl ? 'Ubicación de Google Maps' : newAddress;
        const updatedOrders = await Order.update(
          { deliveryAddress: displayAddress },
          {
            where: {
              userId: sessionContext.userId,
              status: { [Op.in]: ['pending_payment', 'paid', 'preparing', 'ready'] },
            },
          },
        );

        const ordersUpdated = updatedOrders[0] || 0;
        const ordersMsg = ordersUpdated > 0
          ? `\n\n📦 También se actualizó la dirección en ${ordersUpdated} pedido(s) activo(s).`
          : '';

        logger.info('User address updated via cambiarDireccionFlow', {
          userId: sessionContext.userId,
          newAddress: displayAddress,
          ordersUpdated,
        });

        return {
          response:
            '✅ *¡Dirección actualizada con éxito!*\n\n'
            + `📍 Nueva dirección: ${displayAddress}${ordersMsg}\n\n`
            + 'Todas tus próximas entregas se enviarán a esta dirección. 🚗',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      } catch (error) {
        logger.error(`Failed to update address: ${error.message}`);
        return {
          response: '😔 Hubo un error al actualizar tu dirección. Por favor intentá de nuevo o hablá con un operador.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }
    },
  },
};

module.exports = cambiarDireccionFlow;
