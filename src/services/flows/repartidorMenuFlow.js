const logger = require('../../config/logger');
const { User, Order, OrderAssignment } = require('../../models');
const { Op } = require('sequelize');
const assignmentService = require('../assignmentService');

/**
 * Repartidor Menu Flow — Menú dedicado para usuarios con rol 'repartidor'
 * Se activa automáticamente cuando un usuario con rol 'repartidor' envía un mensaje.
 * Muestra entregas pendientes, tareas activas y permite confirmar entregas.
 */
const repartidorMenuFlow = {
  name: 'repartidor_menu',
  description: 'Menú dedicado para repartidores: ver entregas pendientes, tareas y confirmar entrega',

  shouldStart: () => false, // Routing is handled by messageService based on user role

  steps: {
    /**
     * Step 0: Menú principal del repartidor
     */
    0: async (userMessage, sessionContext) => {
      const user = await User.findByPk(sessionContext.userId);

      if (!user || user.role !== 'repartidor') {
        return {
          response: 'Este menú es solo para repartidores. Escribí *MENU* para volver al menú de cliente.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      // Count active delivery assignments for this repartidor
      const activeAssignments = await OrderAssignment.count({
        where: {
          operatorId: user.id,
          role: 'repartidor',
          status: { [Op.ne]: 'completed' },
        },
      });

      // Count ready orders without repartidor
      const readyOrders = await assignmentService.getPendingAssignments('repartidor');

      return {
        response:
          `🚗 *Panel de Repartidor*\n` +
          `Hola, ${user.firstName || 'repartidor'}! 👋\n\n` +
          `📊 *Resumen:*\n` +
          `• Entregas activas: ${activeAssignments}\n` +
          `• Pedidos listos para entregar: ${readyOrders.length}\n\n` +
          `Seleccioná una opción:\n\n` +
          `1️⃣ Ver entregas pendientes\n` +
          `2️⃣ Ver mis entregas activas\n\n` +
          `_Respondé con el número de la opción._`,
        nextStep: 1,
        context: {},
      };
    },

    /**
     * Step 1: Procesar selección del menú repartidor
     */
    1: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      // 1 — Ver entregas pendientes
      if (msg.includes('1') || msg.includes('pendiente') || msg.includes('entreg')) {
        const orders = await assignmentService.getPendingAssignments('repartidor');

        if (!orders.length) {
          return {
            response:
              '🚗 No hay pedidos listos para entregar en este momento.\n\n' +
              '_Escribí *PANEL* para volver al menú de repartidor._',
            nextStep: 1,
            context: {},
          };
        }

        const list = orders.map((o, i) => {
          const productName = o.product?.name || o.subscription?.name || 'Pedido';
          const customer = o.user?.firstName || o.user?.contact || 'N/A';
          const address = o.deliveryAddress || o.user?.address || 'Sin dirección';
          const mapUrl = o.user?.location?.googleMapsUrl ? ` 📎` : '';
          return `${i + 1}. *${productName}* (x${o.quantity}) — 👤 ${customer}\n   📍 ${address}${mapUrl}`;
        }).join('\n\n');

        return {
          response:
            `🚗 *Pedidos disponibles para entregar:*\n\n${list}\n\n` +
            `Respondé con el *número* del pedido para tomarlo.\n\n` +
            `_Escribí *PANEL* para volver._`,
          nextStep: 4,
          context: { pendingOrderIds: orders.map((o) => o.id) },
        };
      }

      // 2 — Mis entregas activas
      if (msg.includes('2') || msg.includes('tarea') || msg.includes('activ') || msg.includes('mis')) {
        const assignments = await assignmentService.getAssignmentsByOperator(sessionContext.userId);
        const repartidorAssignments = assignments.filter((a) => a.role === 'repartidor');

        if (!repartidorAssignments.length) {
          return {
            response:
              '📋 No tenés entregas asignadas en este momento.\n\n' +
              '¿Querés tomar una entrega? Respondé *1*.\n' +
              '_Escribí *PANEL* para volver al menú de repartidor._',
            nextStep: 1,
            context: {},
          };
        }

        const statusLabel = { assigned: '📌 Asignado', in_progress: '⏳ En progreso', completed: '✅ Completado' };

        const list = repartidorAssignments.map((a, i) => {
          const order = a.order;
          const productName = order?.product?.name || order?.subscription?.name || 'Pedido';
          const customer = order?.user?.firstName || order?.user?.contact || 'N/A';
          const address = order?.deliveryAddress || order?.user?.address || 'Sin dirección';
          const mapUrl = order?.user?.location?.googleMapsUrl
            ? `\n   📎 ${order.user.location.googleMapsUrl}`
            : '';
          return (
            `${i + 1}. *${productName}* (x${order?.quantity || 1})\n` +
            `   ${statusLabel[a.status] || a.status}\n` +
            `   👤 ${customer}\n` +
            `   📍 ${address}${mapUrl}`
          );
        }).join('\n\n');

        return {
          response:
            `📋 *Tus entregas activas:*\n\n${list}\n\n` +
            `Respondé con el *número* de la entrega para gestionarla.\n\n` +
            `_Escribí *PANEL* para volver al menú de repartidor._`,
          nextStep: 2,
          context: {
            assignmentIds: repartidorAssignments.map((a) => a.id),
            assignmentOrderIds: repartidorAssignments.map((a) => a.order?.id),
            assignmentStatuses: repartidorAssignments.map((a) => a.order?.status),
          },
        };
      }

      // 3 — Volver al menú de cliente
      if (msg.includes('3') || msg.includes('cliente') || msg.includes('menú') || msg.includes('menu')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'menu',
        };
      }

      // PANEL — volver al menú repartidor
      if (msg.includes('panel')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'repartidor_menu',
        };
      }

      // No reconocido
      return {
        response:
          'No entendí tu selección. Respondé con un número del 1 al 3:\n\n' +
          '1️⃣ Ver entregas pendientes\n2️⃣ Mis entregas activas\n3️⃣ Menú cliente',
        nextStep: 1,
        context: {},
      };
    },

    /**
     * Step 2: Seleccionar una entrega asignada para gestionarla
     */
    2: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('panel')) {
        return { response: null, nextStep: null, context: {}, shouldResetFlow: true, redirectFlow: 'repartidor_menu' };
      }

      const selection = parseInt(msg, 10);
      const assignmentIds = sessionContext.context.assignmentIds || [];

      if (isNaN(selection) || selection < 1 || selection > assignmentIds.length) {
        return {
          response: `Respondé con un número del 1 al ${assignmentIds.length}, o escribí *PANEL* para volver.`,
          nextStep: 2,
          context: sessionContext.context,
        };
      }

      const assignmentId = assignmentIds[selection - 1];

      // Load the assignment with order details
      const assignment = await OrderAssignment.findByPk(assignmentId, {
        include: [{
          association: 'order',
          include: [
            { association: 'user' },
            { association: 'product' },
            { association: 'subscription' },
          ],
        }],
      });

      if (!assignment) {
        return {
          response: 'No se encontró esa entrega. Escribí *PANEL* para volver.',
          nextStep: 1,
          context: {},
        };
      }

      const order = assignment.order;
      const productName = order?.product?.name || order?.subscription?.name || 'Pedido';
      const customer = order?.user?.firstName || order?.user?.contact || 'N/A';
      const address = order?.deliveryAddress || order?.user?.address || 'Sin dirección';
      const mapUrl = order?.user?.location?.googleMapsUrl
        ? `\n📎 Mapa: ${order.user.location.googleMapsUrl}`
        : '';
      const delivery = order?.estimatedDelivery
        ? `\n📅 Entrega: ${new Date(order.estimatedDelivery).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`
        : '';

      let actions = '';
      if (order.status === 'delivering') {
        actions = '\n\n✅ Respondé *ENTREGADO* para confirmar la entrega.';
      }

      return {
        response:
          `📋 *Detalle de entrega:*\n\n` +
          `Pedido: *${productName}* (x${order?.quantity || 1})\n` +
          `Estado: ${order?.status}\n` +
          `👤 Cliente: ${customer}\n` +
          `📍 Dirección: ${address}${mapUrl}${delivery}` +
          actions +
          `\n\n_Escribí *PANEL* para volver al menú de repartidor._`,
        nextStep: 3,
        context: {
          selectedAssignmentId: assignmentId,
          selectedOrderId: order?.id,
          orderStatus: order?.status,
        },
      };
    },

    /**
     * Step 3: Ejecutar acción sobre la entrega (ENTREGADO)
     */
    3: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();
      const { selectedOrderId, orderStatus } = sessionContext.context;

      if (msg.includes('panel')) {
        return { response: null, nextStep: null, context: {}, shouldResetFlow: true, redirectFlow: 'repartidor_menu' };
      }

      // ENTREGADO — Completar entrega
      if (msg.includes('entregado') || msg.includes('entregué') || msg.includes('entregue')) {
        if (orderStatus === 'delivering') {
          try {
            await assignmentService.completeEntrega(selectedOrderId, sessionContext.userId);
            return {
              response:
                '✅ *¡Entrega confirmada!*\n\n' +
                'El cliente fue notificado. ¡Buen trabajo! 🎉\n\n' +
                '_Escribí *PANEL* para volver al menú de repartidor._',
              nextStep: null,
              context: {},
              shouldResetFlow: true,
              redirectFlow: 'repartidor_menu',
            };
          } catch (error) {
            logger.error(`Repartidor flow completeEntrega failed: ${error.message}`);
            return {
              response: `❌ Error: ${error.message}\n\nEscribí *PANEL* para volver.`,
              nextStep: 1,
              context: {},
            };
          }
        }
        return {
          response: 'No podés confirmar la entrega de este pedido en su estado actual.\n\n_Escribí *PANEL* para volver._',
          nextStep: 1,
          context: {},
        };
      }

      // No reconocido
      return {
        response:
          'No entendí tu respuesta. Opciones disponibles:\n' +
          '• *ENTREGADO* — Confirmar entrega\n' +
          '• *PANEL* — Volver al menú de repartidor',
        nextStep: 3,
        context: sessionContext.context,
      };
    },

    /**
     * Step 4: Seleccionar pedido pendiente para auto-asignarse
     */
    4: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('panel')) {
        return { response: null, nextStep: null, context: {}, shouldResetFlow: true, redirectFlow: 'repartidor_menu' };
      }

      const selection = parseInt(msg, 10);
      const pendingOrderIds = sessionContext.context.pendingOrderIds || [];

      if (isNaN(selection) || selection < 1 || selection > pendingOrderIds.length) {
        return {
          response: `Respondé con un número del 1 al ${pendingOrderIds.length}, o escribí *PANEL* para volver.`,
          nextStep: 4,
          context: sessionContext.context,
        };
      }

      const orderId = pendingOrderIds[selection - 1];

      // Load order for confirmation
      const order = await Order.findByPk(orderId, {
        include: [
          { association: 'user' },
          { association: 'product' },
          { association: 'subscription' },
        ],
      });

      if (!order) {
        return {
          response: 'No se encontró ese pedido. Escribí *PANEL* para volver.',
          nextStep: 1,
          context: {},
        };
      }

      const productName = order.product?.name || order.subscription?.name || 'Pedido';
      const customer = order.user?.firstName || order.user?.contact || 'N/A';
      const address = order.deliveryAddress || order.user?.address || 'Sin dirección';

      return {
        response:
          `📋 *Confirmar asignación:*\n\n` +
          `Tarea: 🚗 Entregar\n` +
          `Pedido: *${productName}* (x${order.quantity})\n` +
          `👤 Cliente: ${customer}\n` +
          `📍 ${address}\n\n` +
          `¿Te asignás esta entrega? Respondé *SÍ* o *NO*.`,
        nextStep: 5,
        context: { confirmOrderId: orderId },
      };
    },

    /**
     * Step 5: Confirmar auto-asignación
     */
    5: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('no') || msg.includes('cancelar')) {
        return {
          response: '❌ Asignación cancelada.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'repartidor_menu',
        };
      }

      if (!msg.includes('si') && !msg.includes('sí') && !msg.includes('ok') && !msg.includes('confirmo')) {
        return {
          response: 'Respondé *SÍ* para confirmar o *NO* para cancelar.',
          nextStep: 5,
          context: sessionContext.context,
        };
      }

      const { confirmOrderId } = sessionContext.context;

      try {
        await assignmentService.selfAssign(confirmOrderId, sessionContext.userId, 'repartidor');
        return {
          response:
            `✅ *¡Entrega asignada!*\n\n` +
            `Te asignaste la entrega.\n` +
            `Podés verla en *Mis entregas* desde el panel.\n\n` +
            `_Escribí *PANEL* para volver al menú de repartidor._`,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'repartidor_menu',
        };
      } catch (error) {
        logger.error(`Repartidor self-assign failed: ${error.message}`);
        return {
          response: `❌ Error: ${error.message}\n\nEscribí *PANEL* para volver.`,
          nextStep: 1,
          context: {},
        };
      }
    },
  },
};

module.exports = repartidorMenuFlow;
