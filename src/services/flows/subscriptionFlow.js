const logger = require('../../config/logger');
const { Subscription, UserSubscription } = require('../../models');
const orderService = require('../orderService');

/**
 * Suscripcion Flow — Flujo de contratación de planes de suscripción
 */
const subscriptionFlow = {
  name: 'suscripcion',
  description: 'Flujo de suscripción de maples de huevos',

  shouldStart: (message) => {
    const kw = ['suscripci', 'plan', 'suscrib', 'mensual', 'quincenal', 'semanal'];
    return kw.some((k) => message.toLowerCase().includes(k));
  },

  steps: {
    /**
     * Step 0: Listar planes disponibles
     */
    0: async (userMessage, sessionContext) => {
      const plans = await Subscription.findAll({ where: { isActive: true } });

      if (!plans.length) {
        return {
          response:
            '😔 Por el momento no tenemos planes de suscripción disponibles.\n\n' +
            '¡Pronto tendremos novedades!',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      const freqLabel = (f) => ({ weekly: 'Semanal', biweekly: 'Cada 14 días', monthly: 'Mensual' }[f] || f);

      const planList = plans
        .map(
          (p, i) =>
            `${i + 1}️⃣ *${p.name}*\n` +
            `   📦 ${p.maplesQuantity} maple(s) por entrega\n` +
            `   🔄 Frecuencia: ${freqLabel(p.frequency)}\n` +
            `   💰 $${Number(p.price).toLocaleString('es-AR')} / mes\n` +
            `   _${p.description || ''}_`,
        )
        .join('\n\n');

      return {
        response:
          `📦 *Nuestros planes de suscripción:*\n\n${planList}\n\n` +
          `Respondé con el *número* del plan que te interesa.`,
        nextStep: 1,
        context: { plans: plans.map((p) => ({ id: p.id, name: p.name, price: p.price, maplesQuantity: p.maplesQuantity, frequency: p.frequency })) },
      };
    },

    /**
     * Step 1: Selección de plan
     */
    1: async (userMessage, sessionContext) => {
      const plans = sessionContext.context.plans || [];
      const selection = parseInt(userMessage.trim(), 10);

      if (isNaN(selection) || selection < 1 || selection > plans.length) {
        return {
          response: `Por favor respondé con un número del 1 al ${plans.length}.`,
          nextStep: 1,
          context: sessionContext.context,
        };
      }

      const selected = plans[selection - 1];
      const freqLabel = { weekly: 'semanal', biweekly: 'cada 14 días', monthly: 'mensual' }[selected.frequency] || selected.frequency;

      return {
        response:
          `📋 *Resumen del plan:*\n\n` +
          `Plan: *${selected.name}*\n` +
          `Maples: ${selected.maplesQuantity} por entrega\n` +
          `Frecuencia de entrega: ${freqLabel}\n` +
          `Precio mensual: $${Number(selected.price).toLocaleString('es-AR')}\n\n` +
          `📌 *¿Cómo funciona?*\n` +
          `Pagás el plan una vez por mes. Cada ${freqLabel} te preparamos y enviamos tu pedido automáticamente.\n\n` +
          `¿Confirmás la suscripción? Respondé *SÍ* o *NO*.`,
        nextStep: 2,
        context: { ...sessionContext.context, selectedPlanId: selected.id, selectedPlanName: selected.name, selectedPlanFrequency: selected.frequency },
      };
    },

    /**
     * Step 2: Confirmación y creación de orden + UserSubscription
     */
    2: async (userMessage, sessionContext) => {
      const msg = userMessage.toLowerCase().trim();

      if (msg.includes('no') || msg.includes('cancelar')) {
        return {
          response: '❌ Suscripción cancelada. Cuando quieras intentarlo, ¡acá estoy! 😊',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }

      if (!msg.includes('si') && !msg.includes('sí') && !msg.includes('ok') && !msg.includes('confirmo')) {
        return {
          response: 'Respondé *SÍ* para confirmar o *NO* para cancelar.',
          nextStep: 2,
          context: sessionContext.context,
        };
      }

      try {
        const { selectedPlanId } = sessionContext.context;
        const userId = sessionContext.userId;

        // Create the subscription payment order
        const { order, payment } = await orderService.createSubscriptionOrder(userId, selectedPlanId);

        // Create the UserSubscription record in 'pending_payment' state
        // It will be activated automatically when Mercado Pago confirms the payment
        await UserSubscription.create({
          userId,
          subscriptionId: selectedPlanId,
          status: 'pending_payment',
          metadata: { initialOrderId: order.id },
        });

        logger.info('Subscription order + UserSubscription created', { orderId: order.id, userId, subscriptionId: selectedPlanId });

        return {
          response:
            `✅ *¡Suscripción creada!*\n\n` +
            `Para activarla, realizá el primer pago mensual haciendo click aquí:\n\n` +
            `🔗 ${payment.paymentLink}\n\n` +
            `Una vez confirmado el pago:\n` +
            `📅 Te avisaremos la fecha de tu primera entrega\n` +
            `🔄 El plan se renovará automáticamente cada mes\n` +
            `📦 Recibirás tu pedido según la frecuencia elegida\n\n` +
            `_¡Gracias por elegir Yemas del Sol! 🥚_`,
          nextStep: null,
          context: { orderId: order.id },
          shouldResetFlow: true,
        };
      } catch (error) {
        logger.error(`Failed to create subscription order: ${error.message}`);
        return {
          response: '😔 Hubo un error. Por favor intentá de nuevo o hablá con un operador.',
          nextStep: null,
          context: {},
          shouldResetFlow: true,
        };
      }
    },
  },
};

module.exports = subscriptionFlow;
