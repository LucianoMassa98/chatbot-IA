const logger = require('../config/logger');
const { Conversation, Message, User } = require('../models');
const messageService = require('../services/messageService');

/**
 * Get all conversations
 */
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'contact', 'channel', 'firstName', 'lastName', 'metadata'],
        },
      ],
      order: [['updatedAt', 'DESC']],
    });
    res.json({ success: true, data: conversations });
  } catch (error) {
    logger.error(`Get conversations error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get messages in a conversation
 */
const getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await Message.findAll({
      where: { conversationId: id },
      order: [['createdAt', 'ASC']],
    });
    res.json({ success: true, data: messages });
  } catch (error) {
    logger.error(`Get conversation messages error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send a message from CRM operator/admin to user
 */
const sendCRMMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'El contenido del mensaje es requerido.' });
    }

    const conversation = await Conversation.findByPk(id, {
      include: [{ model: User, as: 'user' }],
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });
    }

    // Send the message using messageService (sends via Meta API and saves to DB)
    const result = await messageService.sendMessage(conversation.user, content);

    // If conversation is waiting, update it to active
    if (conversation.status === 'waiting') {
      await conversation.update({ status: 'active' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Send CRM message error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update conversation status
 */
const updateConversationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'closed', 'waiting'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado inválido. Debe ser active, closed o waiting.' });
    }

    const conversation = await Conversation.findByPk(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });
    }

    await conversation.update({ status });
    logger.info(`Conversation ${id} status updated to ${status}`);
    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error(`Update conversation status error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getConversations,
  getConversationMessages,
  sendCRMMessage,
  updateConversationStatus,
};
