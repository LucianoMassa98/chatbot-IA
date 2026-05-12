const logger = require('../config/logger');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * AI Service - Handles AI responses (mocked - no real API key)
 * This is a placeholder for future integration with OpenAI, Claude, etc.
 */
class AIService {
  /**
   * Generate AI response (mocked)
   */
  async generateResponse(userMessage, context = {}) {
    try {
      if (!env.AI_ENABLED) {
        logger.info('AI service is disabled, using fallback responses');
        return this.getFallbackResponse(userMessage);
      }

      // TODO: Integrate with real AI API
      // This would be replaced with actual API calls to OpenAI, Claude, etc.
      logger.warn('AI service not yet implemented - using fallback');
      return this.getFallbackResponse(userMessage);
    } catch (error) {
      logger.error(`Failed to generate AI response: ${error.message}`);
      return this.getFallbackResponse(userMessage);
    }
  }

  /**
   * Fallback response generator
   */
  getFallbackResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // Simple keyword-based fallback
    if (
      lowerMessage.includes('price') ||
      lowerMessage.includes('cost') ||
      lowerMessage.includes('how much')
    ) {
      return 'Thank you for your interest! Please contact our sales team for pricing information.';
    }

    if (
      lowerMessage.includes('help') ||
      lowerMessage.includes('support') ||
      lowerMessage.includes('problem')
    ) {
      return 'I\'d be happy to help! Could you please describe your issue in more detail?';
    }

    if (
      lowerMessage.includes('hello') ||
      lowerMessage.includes('hi') ||
      lowerMessage.includes('hey')
    ) {
      return 'Hello! 👋 How can I assist you today?';
    }

    if (
      lowerMessage.includes('thank') ||
      lowerMessage.includes('thanks')
    ) {
      return 'You\'re welcome! Is there anything else I can help you with?';
    }

    if (
      lowerMessage.includes('bye') ||
      lowerMessage.includes('goodbye') ||
      lowerMessage.includes('see you')
    ) {
      return 'Thank you for contacting us! Have a great day! 👋';
    }

    // Default response
    return 'Thank you for your message. Our team will respond shortly with more information.';
  }

  /**
   * Check if message requires human intervention
   */
  async shouldEscalate(userMessage) {
    const escalationKeywords = [
      'angry',
      'frustrated',
      'complaint',
      'refund',
      'cancel',
      'urgent',
      'emergency',
    ];

    const lowerMessage = userMessage.toLowerCase();
    return escalationKeywords.some((keyword) => lowerMessage.includes(keyword));
  }
}

module.exports = new AIService();
