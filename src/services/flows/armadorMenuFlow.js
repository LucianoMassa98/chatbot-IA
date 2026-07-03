const logger = require('../../config/logger');
const { User, Order, OrderAssignment } = require('../../models');
const { Op } = require('sequelize');
const assignmentService = require('../assignmentService');
const notificationService = require('../notificationService');

/**
 * Armador Menu Flow — Menú dedicado para usuarios con rol 'armador'
 * Se activa automáticamente cuando un usuario con rol 'armador' envía un mensaje.
 * Muestra productos consolidados por armar, tareas activas y permite marcar como armado.
 */
const armadorMenuFlow = {
  name: 'armador_menu',
  description: 'Menú dedicado para armadores: ver productos por armar, tareas y marcar armado',

  shouldStart: () => false, // Routing is handled by messageService based on user role

  steps: {
    /**
     * Step 0: Menú principal del armador
     */
    0: async (userMessage, sessionContext) => {
      const user = await User.findByPk(sessionContext.userId);

      if (!user || user.role !== 'armador') {
        return {
          response: 'Este menú es solo para armadores. Escribí *MENU* para volver al menú de cliente.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      // Count active assignments for this armador
      const activeAssignments = await OrderAssignment.count({
        where: {
          operatorId: user.id,
          role: 'armador',
          status: { [Op.ne]: 'completed' },
        },
      });

      // Build consolidado of products to assemble
      const consolidado = await notificationService._buildConsolidadoArmador();

      return {
        response:
          `🔧 *Panel de Armador*\n` +
          `Hola, ${user.firstName || 'armador'}! 👋\n\n` +
          `📊 *Resumen:*\n` +
          `• Tareas activas: ${activeAssignments}\n\n` +
          consolidado + `\n` +
          `Seleccioná una opción:\n\n` +
          `1️⃣ Tomar pedido para armar\n` +
          `2️⃣ Ver mis tareas activas\n` +
          `3️⃣ Volver al menú de cliente\n\n` +
          `_Respondé con el número de la opción._`,
        nextStep: 1,
        context: {},
      };
    },

    /**
     * Step 1: Procesar selección del menú armador
     */
    1: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      // 1 — Tomar pedido para armar
      if (msg.includes('1') || msg.includes('tomar') || msg.includes('armar')) {
        const orders = await assignmentService.getPendingAssignments('armador');

        if (!orders.length) {
          return {
            response:
              '📦 No hay pedidos pendientes para armar en este momento.\n\n' +
              '_Escribí *PANEL* para volver al menú de armador._',
            nextStep: 1,
            context: {},
          };
        }

        const list = orders.map((o, i) => {
          const productName = o.product?.name || o.subscription?.name || 'Pedido';
          const customer = o.user?.firstName || o.user?.contact || 'N/A';
          const date = new Date(o.createdAt).toLocaleDateString('es-AR');
          return `${i + 1}. *${productName}* (x${o.quantity}) — 👤 ${customer} — ${date}`;
        }).join('\n');

        return {
          response:
            `📦 *Pedidos disponibles para armar:*\n\n${list}\n\n` +
            `Respondé con el *número* del pedido para tomarlo.\n\n` +
            `_Escribí *PANEL* para volver._`,
          nextStep: 4,
          context: { pendingOrderIds: orders.map((o) => o.id) },
        };
      }

      // 2 — Mis tareas activas
      if (msg.includes('2') || msg.includes('tarea') || msg.includes('activ')) {
        const assignments = await assignmentService.getAssignmentsByOperator(sessionContext.userId);
        const armadorAssignments = assignments.filter((a) => a.role === 'armador');

        if (!armadorAssignments.length) {
          return {
            response:
              '📋 No tenés tareas de armado asignadas en este momento.\n\n' +
              '¿Querés tomar un pedido? Respondé *1*.\n' +
              '_Escribí *PANEL* para volver al menú de armador._',
            nextStep: 1,
            context: {},
          };
        }

        const statusLabel = { assigned: '📌 Asignado', in_progress: '⏳ En progreso', completed: '✅ Completado' };

        const list = armadorAssignments.map((a, i) => {
          const order = a.order;
          const productName = order?.product?.name || order?.subscription?.name || 'Pedido';
          const customer = order?.user?.firstName || order?.user?.contact || 'N/A';
          return (
            `${i + 1}. *${productName}* (x${order?.quantity || 1})\n` +
            `   ${statusLabel[a.status] || a.status}\n` +
            `   👤 ${customer}`
          );
        }).join('\n\n');

        return {
          response:
            `📋 *Tus tareas de armado:*\n\n${list}\n\n` +
            `Respondé con el *número* de la tarea para gestionarla.\n\n` +
            `_Escribí *PANEL* para volver al menú de armador._`,
          nextStep: 2,
          context: {
            assignmentIds: armadorAssignments.map((a) => a.id),
            assignmentOrderIds: armadorAssignments.map((a) => a.order?.id),
            assignmentStatuses: armadorAssignments.map((a) => a.order?.status),
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

      // PANEL — volver al menú armador
      if (msg.includes('panel')) {
        return {
          response: null,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'armador_menu',
        };
      }

      // No reconocido
      return {
        response:
          'No entendí tu selección. Respondé con un número del 1 al 3:\n\n' +
          '1️⃣ Tomar pedido para armar\n2️⃣ Ver mis tareas\n3️⃣ Menú cliente',
        nextStep: 1,
        context: {},
      };
    },

    /**
     * Step 2: Seleccionar una tarea asignada para gestionarla
     */
    2: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('panel')) {
        return { response: null, nextStep: null, context: {}, shouldResetFlow: true, redirectFlow: 'armador_menu' };
      }

      const selection = parseInt(msg, 10);
      const assignmentIds = sessionContext.context.assignmentIds || [];
      const assignmentOrderIds = sessionContext.context.assignmentOrderIds || [];
      const assignmentStatuses = sessionContext.context.assignmentStatuses || [];

      if (isNaN(selection) || selection < 1 || selection > assignmentIds.length) {
        return {
          response: `Respondé con un número del 1 al ${assignmentIds.length}, o escribí *PANEL* para volver.`,
          nextStep: 2,
          context: sessionContext.context,
        };
      }

      const assignmentId = assignmentIds[selection - 1];
      const orderId = assignmentOrderIds[selection - 1];
      const orderStatus = assignmentStatuses[selection - 1];

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
          response: 'No se encontró esa tarea. Escribí *PANEL* para volver.',
          nextStep: 1,
          context: {},
        };
      }

      const order = assignment.order;
      const productName = order?.product?.name || order?.subscription?.name || 'Pedido';
      const customer = order?.user?.firstName || order?.user?.contact || 'N/A';

      let actions = '';
      if (order.status === 'preparing') {
        actions = '\n\n✅ Respondé *LISTO* para marcar como armado.';
      }

      return {
        response:
          `📋 *Detalle de tarea:*\n\n` +
          `Pedido: *${productName}* (x${order?.quantity || 1})\n` +
          `Estado: ${order?.status}\n` +
          `👤 Cliente: ${customer}` +
          actions +
          `\n\n_Escribí *PANEL* para volver al menú de armador._`,
        nextStep: 3,
        context: {
          selectedAssignmentId: assignmentId,
          selectedOrderId: order?.id,
          orderStatus: order?.status,
        },
      };
    },

    /**
     * Step 3: Ejecutar acción sobre la tarea (LISTO)
     */
    3: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();
      const { selectedOrderId, orderStatus } = sessionContext.context;

      if (msg.includes('panel')) {
        return { response: null, nextStep: null, context: {}, shouldResetFlow: true, redirectFlow: 'armador_menu' };
      }

      // LISTO — Completar armado
      if (msg.includes('listo') || msg.includes('armado')) {
        if (orderStatus === 'preparing') {
          try {
            await assignmentService.completeArmado(selectedOrderId, sessionContext.userId);
            return {
              response:
                '✅ *¡Pedido marcado como armado!*\n\n' +
                'El pedido queda listo para que un repartidor lo retire.\n' +
                'El cliente fue notificado. 📦\n\n' +
                '_Escribí *PANEL* para volver al menú de armador._',
              nextStep: null,
              context: {},
              shouldResetFlow: true,
              redirectFlow: 'armador_menu',
            };
          } catch (error) {
            logger.error(`Armador flow completeArmado failed: ${error.message}`);
            return {
              response: `❌ Error: ${error.message}\n\nEscribí *PANEL* para volver.`,
              nextStep: 1,
              context: {},
            };
          }
        }
        return {
          response: 'No podés marcar este pedido como armado en su estado actual.\n\n_Escribí *PANEL* para volver._',
          nextStep: 1,
          context: {},
        };
      }

      // No reconocido
      return {
        response:
          'No entendí tu respuesta. Opciones disponibles:\n' +
          '• *LISTO* — Marcar como armado\n' +
          '• *PANEL* — Volver al menú de armador',
        nextStep: 3,
        context: sessionContext.context,
      };
    },

    /**
     * Step 4: Confirmar auto-asignación de un pedido para armar
     */
    4: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('panel')) {
        return { response: null, nextStep: null, context: {}, shouldResetFlow: true, redirectFlow: 'armador_menu' };
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

      return {
        response:
          `📋 *Confirmar asignación:*\n\n` +
          `Tarea: 🔧 Armar\n` +
          `Pedido: *${productName}* (x${order.quantity})\n` +
          `👤 Cliente: ${customer}\n\n` +
          `¿Te asignás este pedido? Respondé *SÍ* o *NO*.`,
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
          redirectFlow: 'armador_menu',
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
        await assignmentService.selfAssign(confirmOrderId, sessionContext.userId, 'armador');
        return {
          response:
            `✅ *¡Pedido asignado!*\n\n` +
            `Te asignaste el pedido para armar.\n` +
            `Podés verlo en *Mis tareas* desde el panel.\n\n` +
            `_Escribí *PANEL* para volver al menú de armador._`,
          nextStep: null,
          context: {},
          shouldResetFlow: true,
          redirectFlow: 'armador_menu',
        };
      } catch (error) {
        logger.error(`Armador self-assign failed: ${error.message}`);
        return {
          response: `❌ Error: ${error.message}\n\nEscribí *PANEL* para volver.`,
          nextStep: 1,
          context: {},
        };
      }
    },
  },
};

module.exports = armadorMenuFlow;
