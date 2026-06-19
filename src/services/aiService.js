const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger');
const env = require('../config/env');

/**
 * AI Service - Handles AI responses via Google Gemini
 */
class AIService {
  constructor() {
    this.client = null;
    this.model = null;

    if (env.AI_ENABLED && env.AI_API_KEY) {
      try {
        this.client = new GoogleGenerativeAI(env.AI_API_KEY);
        this.model = this.client.getGenerativeModel({
          model: env.AI_MODEL || 'gemini-2.0-flash',
          systemInstruction: env.AI_SYSTEM_PROMPT ||
            'You are a helpful and friendly customer support assistant. ' +
            'Answer questions clearly and concisely. ' +
            'If you cannot help with something, politely redirect the user to a human agent.',
        });
        logger.info('Gemini AI service initialized successfully');
      } catch (error) {
        logger.error(`Failed to initialize Gemini AI: ${error.message}`);
      }
    }
  }

  /**
   * Generate AI response using Gemini
   * @param {string} userMessage - The user's message
   * @param {object} context - Session context (conversation history, etc.)
   */
  async generateResponse(userMessage, context = {}) {
    try {
      if (!env.AI_ENABLED) {
        logger.info('AI service is disabled, using fallback responses');
        return this.getFallbackResponse(userMessage);
      }

      if (!this.model) {
        logger.warn('Gemini model not initialized - check AI_API_KEY. Using fallback.');
        return this.getFallbackResponse(userMessage);
      }

      // Build conversation history for multi-turn context
      const history = this._buildHistory(context.history || []);

      const chat = this.model.startChat({ history });

      logger.info('Sending message to Gemini', { userMessage: userMessage.substring(0, 50) });

      const result = await chat.sendMessage(userMessage);
      const responseText = result.response.text();

      logger.info('Gemini response received', { responseLength: responseText.length });

      return responseText;

    } catch (error) {
      logger.error(`Gemini API error: ${error.message}`);
      // Graceful fallback on API error
      return this.getFallbackResponse(userMessage);
    }
  }

  /**
   * Build Gemini-compatible chat history from session context
   * @param {Array} history - Array of { role, text } objects
   */
  _buildHistory(history) {
    return history
      .filter((entry) => entry.role && entry.text)
      .map((entry) => ({
        role: entry.role === 'bot' ? 'model' : 'user',
        parts: [{ text: entry.text }],
      }));
  }

  /**
   * Fallback response when AI is disabled or unavailable
   */
  getFallbackResponse(userMessage) {
    const lowerMessage = (userMessage || '').toLowerCase();

    if (lowerMessage.includes('precio') || lowerMessage.includes('price') || lowerMessage.includes('costo')) {
      return 'Gracias por tu interés. Para información de precios, por favor contáctanos con nuestro equipo de ventas.';
    }

    if (lowerMessage.includes('ayuda') || lowerMessage.includes('help') || lowerMessage.includes('problema')) {
      return '¡Con gusto te ayudo! ¿Podrías describir tu problema con más detalle?';
    }

    if (lowerMessage.includes('hola') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return '¡Hola! 👋 ¿En qué puedo ayudarte hoy?';
    }

    if (lowerMessage.includes('gracias') || lowerMessage.includes('thank')) {
      return '¡De nada! ¿Hay algo más en lo que pueda ayudarte?';
    }

    if (lowerMessage.includes('adios') || lowerMessage.includes('bye') || lowerMessage.includes('chau')) {
      return '¡Hasta luego! Que tengas un excelente día 👋';
    }

    return 'Gracias por tu mensaje. Nuestro equipo te responderá a la brevedad.';
  }

  /**
   * Check if message requires human intervention
   */
  async shouldEscalate(userMessage) {
    const escalationKeywords = [
      'enojado', 'furioso', 'queja', 'reembolso', 'cancelar',
      'urgente', 'emergencia', 'angry', 'frustrated', 'complaint',
      'refund', 'cancel', 'urgent', 'emergency',
    ];

    const lowerMessage = (userMessage || '').toLowerCase();
    return escalationKeywords.some((keyword) => lowerMessage.includes(keyword));
  }
}

module.exports = new AIService();
