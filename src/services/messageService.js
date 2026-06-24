const { User, Conversation, Message, Session } = require('../models');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const sessionService = require('./sessionService');
const flowService = require('./flowService');
const aiService = require('./aiService');
const metaService = require('./metaService');
const { normalizeMessage } = require('../utils/messageNormalizer');
const registroClienteFlow = require('./flows/registroClienteFlow');

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

      // 5. If new user on WhatsApp, send the registro_cliente Flow natively
      if (isNewUser && channel === 'whatsapp') {
        logger.info(`New WhatsApp user detected (${userId}). Sending registro_cliente flow.`);
        const env = require('../config/env');
        const phoneNumberId = (metadata && metadata.phoneNumberId) || env.META_PHONE_NUMBER_ID;
        try {
          const flowResult = await registroClienteFlow.sendToNewUser(phoneNumberId, userId);
          // Save the outgoing flow message to conversation history
          await Message.create({
            conversationId: conversation.id,
            direction: 'out',
            content: '[WhatsApp Flow: registro_cliente enviado]',
            messageType: 'interactive',
            externalId: flowResult?.messages?.[0]?.id || null,
            metadata: { flowId: registroClienteFlow.flowId, source: 'registro_cliente' },
          });
          logger.info(`registro_cliente flow sent successfully to new user ${userId}`);
        } catch (flowError) {
          // Fallback: if the native Flow fails, send the text-based welcome step
          logger.warn(`Failed to send native registro_cliente flow to ${userId}: ${flowError.message}. Falling back to text.`);
          await sessionService.updateFlow(user.id, 'registro_cliente', 0, { isNewUser: true });
        }
        return {
          userId: user.id,
          channel: user.channel,
          contact: user.contact,
          response: 'registro_cliente flow sent',
          messageId: null,
        };
      }

      // 6. Determine response (existing users)
      const response = await this.generateResponse(user, text);

      // 6. Send message to user (which also saves it to the database)
      const additionalParams = {};
      if (channel === 'whatsapp') {
        const env = require('../config/env');
        additionalParams.phoneNumberId = (metadata && metadata.phoneNumberId) || env.META_PHONE_NUMBER_ID;
      }

      let outgoingMessageId = null;
      try {
        const sendResult = await this.sendMessage(user, response.text, additionalParams);
        outgoingMessageId = sendResult.messages && sendResult.messages[0] ? sendResult.messages[0].id : null;
        logger.info(`Response sent to user ${userId} on ${channel}`);
      } catch (sendError) {
        logger.error(`Failed to send message via Meta API: ${sendError.message}`);
        // Fallback: save message locally so conversation history remains intact
        const outgoingMessage = await Message.create({
          conversationId: conversation.id,
          direction: 'out',
          content: response.text,
          messageType: 'text',
          metadata: { ...(response.metadata || {}), error: sendError.message },
        });
        outgoingMessageId = outgoingMessage.id;
      }

      return {
        userId: user.id,
        channel: user.channel,
        contact: user.contact,
        response: response.text,
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

      // Check if user should continue in current flow
      if (sessionContext.currentFlow !== 'idle') {
        const flowResult = await this.executeCurrentFlow(
          user.id,
          sessionContext.currentFlow,
          userMessage,
          sessionContext,
        );

        if (flowResult) {
          return flowResult;
        }
      }

      // Check which flow to start
      const shouldStartSales = await flowService.shouldStartFlow('sales', userMessage);
      const shouldStartSupport = await flowService.shouldStartFlow('support', userMessage);

      if (shouldStartSales) {
        await sessionService.updateFlow(user.id, 'sales', 0, {});
        return this.executeCurrentFlow(user.id, 'sales', userMessage, sessionContext);
      }

      if (shouldStartSupport) {
        await sessionService.updateFlow(user.id, 'support', 0, {});
        return this.executeCurrentFlow(user.id, 'support', userMessage, sessionContext);
      }

      // Fallback to AI service
      const aiResponse = await aiService.generateResponse(userMessage, sessionContext.context);

      const shouldEscalate = await aiService.shouldEscalate(userMessage);

      if (shouldEscalate) {
        logger.warn(`Message escalated for user ${user.id}: ${userMessage}`);
        await sessionService.updateFlow(user.id, 'support', 0, {
          escalated: true,
          originalMessage: userMessage,
        });
      }

      return {
        text: aiResponse,
        metadata: {
          source: 'ai_fallback',
          escalated: shouldEscalate,
        },
      };
    } catch (error) {
      logger.error(`Failed to generate response: ${error.message}`);
      return {
        text: 'Thank you for your message. Our team will respond shortly.',
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
