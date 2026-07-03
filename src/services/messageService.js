const { User, Conversation, Message, Session } = require('../models');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const sessionService = require('./sessionService');
const flowService = require('./flowService');
const aiService = require('./aiService');
const metaService = require('./metaService');
const { normalizeMessage } = require('../utils/messageNormalizer');
// registroClienteFlow native flow disabled (Meta #139000 integrity error)
// New users receive a text welcome message and are routed to menuFlow instead.

// Yemas del Sol flows (registered separately in app.js, referenced here for redirect support)
const YEMAS_FLOWS = ['menu', 'compra', 'suscripcion', 'pedidos', 'cambiar_direccion', 'reprogramar', 'support', 'armador_menu', 'repartidor_menu'];

/**
 * Message Service - Main orchestrator for message handling and response generation
 */
class MessageService {
  /**
   * Process incoming webhook message
   */
  async processIncomingMessage(normalizedMessage) {
    try {
      const { userId, text, channel, messageType, externalId, metadata } = normalizedMessage;

      logger.info(`Processing message from user ${userId}`, { channel, messageType });

      // 1. Get or create user (isNewUser indicates first-time contact)
      const { user, isNewUser } = await this.getOrCreateUser(userId, channel, metadata);

      // 2. Get or create conversation
      const conversation = await this.getOrCreateConversation(user.id);

      // 3. Save incoming message
      await Message.create({
        conversationId: conversation.id,
        direction: 'in',
        content: text,
        messageType: messageType,
        externalId: externalId,
        metadata,
      });

      // 4. Get or create session
      await sessionService.getOrCreateSession(user.id);

      // 5. New WhatsApp user — send welcome message and route to menuFlow
      //    NOTE: Native WhatsApp Flow (registro_cliente) is disabled.
      //    Registration data (address, schedule) is collected progressively through conversation.
      if (isNewUser && channel === 'whatsapp') {
        logger.info(`New WhatsApp user detected (${userId}). Sending welcome message.`);

        const env = require('../config/env');
        const phoneNumberId = (metadata && metadata.phoneNumberId) || env.META_PHONE_NUMBER_ID;

        const welcomeText =
          `👋 ¡Hola! Bienvenido/a a *Yemas del Sol* 🐔🥚\n\n` +
          `Te entregamos en tu domicilio.\n\n` +
          `¿En qué puedo ayudarte hoy?`;

        let outgoingMessageId = null;
        try {
          const sendResult = await metaService.sendWhatsAppMessage(
            phoneNumberId,
            userId,
            welcomeText,
          );
          outgoingMessageId = sendResult?.messages?.[0]?.id || null;

          await Message.create({
            conversationId: conversation.id,
            direction: 'out',
            content: welcomeText,
            messageType: 'text',
            externalId: outgoingMessageId,
            metadata: { source: 'welcome_new_user' },
          });

          logger.info(`Welcome message sent to new user ${userId}`);
        } catch (sendError) {
          logger.error(`Failed to send welcome to new user ${userId}: ${sendError.message}`);
        }

        // Set session to menuFlow so next message shows the main menu
        await sessionService.updateFlow(user.id, 'menu', 0, { isNewUser: true });

        return {
          userId: user.id,
          channel: user.channel,
          contact: user.contact,
          response: welcomeText,
          messageId: outgoingMessageId,
        };
      }

      // 6. Determine response (existing users)
      const response = await this.generateResponse(user, text);

      // 6. Send message to user (which also saves it to the database)
      const additionalParams = {};
      if (channel === 'whatsapp') {
        const env = require('../config/env');
        additionalParams.phoneNumberId = (metadata && metadata.phoneNumberId) || env.META_PHONE_NUMBER_ID;
        if (response && response.interactive) {
          additionalParams.interactive = response.interactive;
        }
      }

      let outgoingMessageId = null;
      const textToSend = response ? (response.text || response.interactive?.body?.text) : null;

      if (textToSend) {
        try {
          const sendResult = await this.sendMessage(user, textToSend, additionalParams);
          outgoingMessageId = sendResult.messages && sendResult.messages[0] ? sendResult.messages[0].id : null;
          logger.info(`Response sent to user ${userId} on ${channel}`);
        } catch (sendError) {
          logger.error(`Failed to send message via Meta API: ${sendError.message}`);
          // Fallback: save message locally so conversation history remains intact
          const outgoingMessage = await Message.create({
            conversationId: conversation.id,
            direction: 'out',
            content: textToSend,
            messageType: 'text',
            metadata: { ...((response && response.metadata) || {}), error: sendError.message },
          });
          outgoingMessageId = outgoingMessage.id;
        }
      } else {
        logger.warn(`No response text to send to user ${userId}`);
      }

      return {
        userId: user.id,
        channel: user.channel,
        contact: user.contact,
        response: textToSend,
        messageId: outgoingMessageId,
      };

    } catch (error) {
      logger.error(`Failed to process incoming message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get or create user
   */
  async getOrCreateUser(userId, channel, metadata = {}) {
    try {
      let user = await User.findOne({
        where: {
          contact: userId,
          channel,
        },
      });

      let isNewUser = false;

      if (!user) {
        user = await User.create({
          contact: userId,
          channel,
          metadata: {
            ...metadata,
            createdAt: new Date().toISOString(),
          },
        });

        isNewUser = true;
        logger.info(`New user created: ${userId} on ${channel}`);
      }

      return { user, isNewUser };
    } catch (error) {
      logger.error(`Failed to get/create user: ${error.message}`);
      throw new AppError('Failed to get user', 500);
    }
  }

  /**
   * Get or create conversation
   */
  async getOrCreateConversation(userId) {
    try {
      let conversation = await Conversation.findOne({
        where: {
          userId: userId,
          status: 'active',
        },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          userId: userId,
          status: 'active',
          metadata: {
            startedAt: new Date().toISOString(),
          },
        });

        logger.info(`New conversation created for user ${userId}`);
      }

      return conversation;
    } catch (error) {
      logger.error(`Failed to get/create conversation: ${error.message}`);
      throw new AppError('Failed to get conversation', 500);
    }
  }

  /**
   * Generate response based on current flow or AI
   */
  async generateResponse(user, userMessage) {
    try {
      const sessionContext = await sessionService.getSessionContext(user.id);

      if (!sessionContext) {
        throw new AppError('Session not found', 404);
      }

      // Inject userId into context so flows can query user-specific data
      sessionContext.userId = user.id;

      // Check if user should continue in current flow
      if (sessionContext.currentFlow !== 'idle') {
        const flowResult = await this.executeCurrentFlow(
          user.id,
          sessionContext.currentFlow,
          userMessage,
          sessionContext,
        );

        if (flowResult) {
          // Handle flow redirect (e.g. menu redirects to compra)
          if (flowResult.redirectFlow) {
            const targetFlow = flowResult.redirectFlow;
            await sessionService.updateFlow(user.id, targetFlow, 0, {});
            const newContext = await sessionService.getSessionContext(user.id);
            newContext.userId = user.id;
            return this.executeCurrentFlow(user.id, targetFlow, userMessage, newContext);
          }
          // Handle waiting for operator
          if (flowResult.setConversationWaiting) {
            await Conversation.update(
              { status: 'waiting' },
              { where: { userId: user.id, status: 'active' } },
            );
          }
          return flowResult;
        }
      }

      // Role-based flow routing: armador/repartidor get their dedicated menus
      if (user.role === 'armador') {
        await sessionService.updateFlow(user.id, 'armador_menu', 0, {});
        const newContext = await sessionService.getSessionContext(user.id);
        newContext.userId = user.id;
        return this.executeCurrentFlow(user.id, 'armador_menu', userMessage, newContext);
      }

      if (user.role === 'repartidor') {
        await sessionService.updateFlow(user.id, 'repartidor_menu', 0, {});
        const newContext = await sessionService.getSessionContext(user.id);
        newContext.userId = user.id;
        return this.executeCurrentFlow(user.id, 'repartidor_menu', userMessage, newContext);
      }

      // Check which Yemas del Sol flow to start (cliente / administrador)
      for (const flowName of YEMAS_FLOWS) {
        const shouldStart = await flowService.shouldStartFlow(flowName, userMessage, user.id);
        if (shouldStart) {
          await sessionService.updateFlow(user.id, flowName, 0, {});
          const newContext = await sessionService.getSessionContext(user.id);
          newContext.userId = user.id;
          return this.executeCurrentFlow(user.id, flowName, userMessage, newContext);
        }
      }

      // Default: show main menu (cliente / administrador)
      await sessionService.updateFlow(user.id, 'menu', 0, {});
      const newContext = await sessionService.getSessionContext(user.id);
      newContext.userId = user.id;
      return this.executeCurrentFlow(user.id, 'menu', userMessage, newContext);

    } catch (error) {
      logger.error(`Failed to generate response: ${error.message}`);
      return {
        text: '😔 Ocurrió un error. Por favor intentá de nuevo o escribí *MENU*.',
        metadata: { source: 'fallback_error' },
      };
    }
  }

  /**
   * Execute current flow step
   */
  async executeCurrentFlow(userId, flowName, userMessage, sessionContext) {
    try {
      const currentStep = sessionContext.flowStep || 0;

      const flowResult = await flowService.executeFlowStep(
        flowName,
        currentStep,
        userMessage,
        sessionContext,
      );

      // Update session with next step
      const nextStep = flowResult.nextStep !== undefined ? flowResult.nextStep : currentStep + 1;

      if (nextStep !== null) {
        await sessionService.updateFlow(
          userId,
          flowName,
          nextStep,
          flowResult.context,
        );
      } else if (flowResult.shouldResetFlow) {
        await sessionService.clearSession(userId);
      }

      return {
        text: flowResult.response,
        redirectFlow: flowResult.redirectFlow,
        setConversationWaiting: flowResult.setConversationWaiting,
        interactive: flowResult.interactive,
        metadata: {
          source: `flow_${flowName}`,
          step: currentStep,
          nextStep,
        },
      };
    } catch (error) {
      logger.error(`Failed to execute flow: ${error.message}`);
      return null;
    }
  }

  /**
   * Send message to user (through Meta API)
   */
  async sendMessage(user, messageText, additionalParams = {}) {
    try {
      const result = await metaService.sendMessage(
        user.channel,
        user.contact,
        messageText,
        additionalParams,
      );

      // Save sent message
      const conversation = await Conversation.findOne({
        where: {
          userId: user.id,
          status: 'active',
        },
      });

      if (conversation) {
        await Message.create({
          conversationId: conversation.id,
          direction: 'out',
          content: messageText,
          messageType: 'text',
          externalId: result.messages ? result.messages[0].id : null,
        });
      }

      return result;
    } catch (error) {
      logger.error(`Failed to send message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(userId, limit = 50) {
    try {
      const conversation = await Conversation.findOne({
        where: { userId: userId },
        include: {
          association: 'messages',
          limit,
          order: [['created_at', 'DESC']],
        },
      });

      if (!conversation) {
        return [];
      }

      return conversation.messages.reverse();
    } catch (error) {
      logger.error(`Failed to get conversation history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close conversation
   */
  async closeConversation(userId) {
    try {
      const conversation = await Conversation.findOne({
        where: {
          userId: userId,
          status: 'active',
        },
      });

      if (conversation) {
        await conversation.update({ status: 'closed' });
        await sessionService.clearSession(userId);
      }

      return conversation;
    } catch (error) {
      logger.error(`Failed to close conversation: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new MessageService();
