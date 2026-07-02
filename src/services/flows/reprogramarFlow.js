const logger = require('../../config/logger');
const { Order, User } = require('../../models');
const { Op } = require('sequelize');
const orderService = require('../orderService');

/**
 * Reprogramar Flow — Permite al usuario reprogramar la fecha de entrega de un pedido
 * Se activa desde el menú principal (opción 5) o por keywords.
 */
const reprogramarFlow = {
  name: 'reprogramar',
  description: 'Flujo para reprogramar la fecha de entrega de un pedido',

  shouldStart: (message) => {
    const kw = ['reprogramar', 'cambiar fecha', 'otra fecha', 'postergar', 'adelantar', 'reagendar'];
    return kw.some((k) => message.toLowerCase().includes(k));
  },

  steps: {
    /**
     * Step 0: Listar pedidos reprogramables
     */
    0: async (userMessage, sessionContext) => {
      const userId = sessionContext.userId;

      const orders = await Order.findAll({
        where: {
          userId,
          status: { [Op.in]: ['paid', 'preparing', 'ready', 'rescheduled'] },
        },
        include: [
          { association: 'product' },
          { association: 'subscription' },
        ],
        order: [['created_at', 'DESC']],
      });

      if (!orders.length) {
        return {
          response:
            '📋 No tenés pedidos que puedan reprogramarse en este momento.\n\n' +
            'Solo se pueden reprogramar pedidos que estén pagados, en preparación o listos para envío.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      const statusLabel = {
        paid: '✅ Pago confirmado',
        preparing: '🔧 En preparación',
        ready: '📦 Listo para envío',
        rescheduled: '🔄 Ya reprogramado',
      };

      const orderList = orders
        .map((o, i) => {
          const name = o.product?.name || o.subscription?.name || 'Pedido';
          const status = statusLabel[o.status] || o.status;
          const delivery = o.estimatedDelivery
            ? `\n   🕐 Entrega: ${new Date(o.estimatedDelivery).toLocaleDateString('es-AR')}`
            : '\n   🕐 Entrega: Sin fecha asignada';
          return `${i + 1}. *${name}* (x${o.quantity})\n   ${status}${delivery}`;
        })
        .join('\n\n');

      return {
        response:
          `📋 *Pedidos que podés reprogramar:*\n\n${orderList}\n\n` +
          `Respondé con el *número* del pedido que querés reprogramar.\n\n` +
          `_Escribí *CANCELAR* para volver al menú._`,
        nextStep: 1,
        context: { orderIds: orders.map((o) => o.id) },
      };
    },

    /**
     * Step 1: Seleccionar pedido y mostrar opciones de fecha
     */
    1: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      // Cancelar
      if (msg.includes('cancelar') || msg.includes('menu') || msg.includes('menú') || msg.includes('volver')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'menu',
        };
      }

      const selection = parseInt(msg, 10);
      const orderIds = sessionContext.context.orderIds || [];

      if (isNaN(selection) || selection < 1 || selection > orderIds.length) {
        return {
          response: `Respondé con un número del 1 al ${orderIds.length}, o escribí *CANCELAR* para volver.`,
          nextStep: 1,
          context: sessionContext.context,
        };
      }

      const orderId = orderIds[selection - 1];
      const order = await Order.findByPk(orderId, {
        include: [
          { association: 'product' },
          { association: 'subscription' },
        ],
      });

      if (!order) {
        return {
          response: 'No encontré ese pedido. Intentá de nuevo.',
          nextStep: 1,
          context: sessionContext.context,
        };
      }

      // Calculate next 3 available delivery dates
      const deliveryOptions = [];
      let fromDate = new Date();

      for (let i = 0; i < 3; i++) {
        // Start searching from the next day after the previous option
        if (i > 0 && deliveryOptions.length > 0) {
          fromDate = new Date(deliveryOptions[i - 1].date);
          fromDate.setDate(fromDate.getDate() + 1);
        }
        const option = await orderService.calculateNextDeliveryTime(fromDate);
        deliveryOptions.push(option);
      }

      const currentDelivery = order.estimatedDelivery
        ? new Date(order.estimatedDelivery).toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Sin fecha asignada';

      const productName = order.product?.name || order.subscription?.name || 'Pedido';

      const dateOptions = deliveryOptions
        .map((opt, i) => {
          const dateStr = new Date(opt.date).toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });
          return `${i + 1}️⃣ ${dateStr} (${opt.startTime} – ${opt.endTime} hs)`;
        })
        .join('\n');

      return {
        response:
          `📦 *${productName}* (x${order.quantity})\n` +
          `🕐 Entrega actual: ${currentDelivery}\n\n` +
          `Seleccioná la nueva fecha de entrega:\n\n${dateOptions}\n\n` +
          `Respondé con el *número* de la opción.\n\n` +
          `_Escribí *CANCELAR* para volver al menú._`,
        nextStep: 2,
        context: {
          ...sessionContext.context,
          selectedOrderId: orderId,
          selectedOrderName: productName,
          currentDelivery,
          deliveryOptions: deliveryOptions.map((opt) => ({
            date: opt.date.toISOString(),
            startTime: opt.startTime,
            endTime: opt.endTime,
          })),
        },
      };
    },

    /**
     * Step 2: Seleccionar fecha y pedir confirmación
     */
    2: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      // Cancelar
      if (msg.includes('cancelar') || msg.includes('menu') || msg.includes('menú') || msg.includes('volver')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'menu',
        };
      }

      const selection = parseInt(msg, 10);
      const deliveryOptions = sessionContext.context.deliveryOptions || [];

      if (isNaN(selection) || selection < 1 || selection > deliveryOptions.length) {
        return {
          response: `Respondé con un número del 1 al ${deliveryOptions.length}, o escribí *CANCELAR* para volver.`,
          nextStep: 2,
          context: sessionContext.context,
        };
      }

      const selectedOption = deliveryOptions[selection - 1];
      const newDateStr = new Date(selectedOption.date).toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      return {
        response:
          `📋 *Confirmá la reprogramación:*\n\n` +
          `📦 Pedido: *${sessionContext.context.selectedOrderName}*\n` +
          `🕐 Fecha anterior: ${sessionContext.context.currentDelivery}\n` +
          `🕐 Nueva fecha: ${newDateStr} (${selectedOption.startTime} – ${selectedOption.endTime} hs)\n\n` +
          `¿Confirmás la reprogramación? Respondé *SÍ* o *NO*.`,
        nextStep: 3,
        context: {
          ...sessionContext.context,
          selectedDate: selectedOption.date,
          selectedDateDisplay: newDateStr,
          selectedTimeWindow: `${selectedOption.startTime} – ${selectedOption.endTime}`,
        },
      };
    },

    /**
     * Step 3: Confirmar y actualizar la fecha de entrega
     */
    3: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      // Cancelar
      if (msg.includes('no') || msg.includes('cancelar')) {
        return {
          response: '❌ Reprogramación cancelada. Tu pedido mantiene la fecha original.',
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
          nextStep: 3,
          context: sessionContext.context,
        };
      }

      try {
        const { selectedOrderId, selectedDate, selectedDateDisplay, selectedTimeWindow, selectedOrderName } = sessionContext.context;

        const order = await Order.findByPk(selectedOrderId);

        if (!order) {
          return {
            response: '❌ No se encontró el pedido. Por favor intentá de nuevo.',
            nextStep: null,
            context: {},
            shouldResetFlow: true,
          };
        }

        // Actualizar fecha de entrega
        const updateData = {
          estimatedDelivery: new Date(selectedDate),
        };

        // Cambiar status a 'rescheduled' si el pedido estaba en delivering u otro estado avanzado
        // Para paid/preparing/ready mantenemos el status actual ya que todavía se puede reprogramar sin impacto
        if (['delivering'].includes(order.status)) {
          updateData.status = 'rescheduled';
        }

        await order.update(updateData);

        logger.info('Order delivery rescheduled via reprogramarFlow', {
          orderId: selectedOrderId,
          userId: sessionContext.userId,
          newDelivery: selectedDate,
        });

        return {
          response:
            `✅ *¡Entrega reprogramada con éxito!*\n\n` +
            `📦 Pedido: *${selectedOrderName}*\n` +
            `📅 Nueva fecha: ${selectedDateDisplay}\n` +
            `🕐 Horario: ${selectedTimeWindow} hs\n\n` +
            `Te avisaremos cuando el pedido esté en camino. 🚗`,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      } catch (error) {
        logger.error(`Failed to reschedule delivery: ${error.message}`);
        return {
          response: '😔 Hubo un error al reprogramar tu entrega. Por favor intentá de nuevo o hablá con un operador.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }
    },
  },
};

module.exports = reprogramarFlow;
