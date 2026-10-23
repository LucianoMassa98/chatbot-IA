const logger = require('../../config/logger');
const orderService = require('../orderService');

/**
 * Pedido Flow — Consulta y seguimiento de pedidos del cliente
 */
const pedidoFlow = {
  name: 'pedidos',
  description: 'Flujo de consulta de pedidos del cliente',

  shouldStart: (message) => {
    const kw = ['pedido', 'estado', 'entrega', 'cuando llega', 'cuándo llega', 'donde está', 'dónde está', 'mi orden'];
    return kw.some((k) => message.toLowerCase().includes(k));
  },

  steps: {
    /**
     * Step 0: Consultar pedidos activos
     */
    0: async (userMessage, sessionContext) => {
      const { userId } = sessionContext;
      const orders = await orderService.getOrdersByUser(userId);

      if (!orders.length) {
        return {
          response:
            '📋 No tenés pedidos registrados todavía.\n\n'
            + '¿Querés hacer una compra? Respondé *COMPRAR* o elegí del menú principal.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      const statusLabel = {
        pending_payment: '⏳ Pendiente de pago',
        paid: '✅ Pago confirmado',
        preparing: '🔧 En preparación',
        ready: '📦 Pedido armado',
        delivering: '🚗 En camino',
        delivered: '✅ Entregado',
        rescheduled: '🔄 Reprogramado',
        cancelled: '❌ Cancelado',
      };

      // Show latest 5 orders
      const recent = orders.slice(0, 5);
      const orderList = recent
        .map((o, i) => {
          const name = o.product?.name || o.subscription?.name || 'Pedido';
          const status = statusLabel[o.status] || o.status;
          const date = new Date(o.createdAt).toLocaleDateString('es-AR');
          const delivery = o.estimatedDelivery
            ? `\n   🕐 Entrega est.: ${new Date(o.estimatedDelivery).toLocaleDateString('es-AR')}`
            : '';
          return `${i + 1}. *${name}* (x${o.quantity})\n   ${status} — ${date}${delivery}`;
        })
        .join('\n\n');

      return {
        response:
          `📋 *Tus pedidos recientes:*\n\n${orderList}\n\n`
          + '¿Querés más información de alguno? Respondé con el número o escribí *MENU* para volver.',
        nextStep: 1,
        context: { orderIds: recent.map((o) => o.id) },
      };
    },

    /**
     * Step 1: Detalle de un pedido específico
     */
    1: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('menu') || msg.includes('menú') || msg.includes('volver')) {
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
          response: `Respondé con un número del 1 al ${orderIds.length}, o escribí *MENU* para volver.`,
          nextStep: 1,
          context: sessionContext.context,
        };
      }

      const orderId = orderIds[selection - 1];
      const orders = await orderService.getOrdersByUser(sessionContext.userId);
      const order = orders.find((o) => o.id === orderId);

      if (!order) {
        return {
          response: 'No encontré ese pedido. Intentá de nuevo.',
          nextStep: 1,
          context: sessionContext.context,
        };
      }

      const statusLabel = {
        pending_payment: '⏳ Pendiente de pago',
        paid: '✅ Pago confirmado',
        preparing: '🔧 En preparación',
        ready: '📦 Pedido armado',
        delivering: '🚗 En camino',
        delivered: '✅ Entregado',
        rescheduled: '🔄 Reprogramado',
        cancelled: '❌ Cancelado',
      };

      const productName = order.product?.name || order.subscription?.name || 'Pedido';
      const detail = '📦 *Detalle del pedido:*\n\n'
        + `Producto: ${productName}\n`
        + `Cantidad: ${order.quantity} maple(s)\n`
        + `Total: $${Number(order.total).toLocaleString('es-AR')}\n`
        + `Estado: ${statusLabel[order.status] || order.status}\n`
        + `Dirección: ${order.deliveryAddress || 'No especificada'}\n${
          order.estimatedDelivery ? `Entrega estimada: ${new Date(order.estimatedDelivery).toLocaleString('es-AR')}\n` : ''
        }${order.notes ? `Nota: ${order.notes}\n` : ''
        }\nFecha del pedido: ${new Date(order.createdAt).toLocaleDateString('es-AR')}`;

      return {
        response: detail,
        nextStep: null,
        context: {},
        shouldResetFlow: true,
      };
    },
  },
};

module.exports = pedidoFlow;
