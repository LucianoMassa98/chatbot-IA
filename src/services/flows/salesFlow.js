const logger = require('../../config/logger');

/**
 * Sales Flow Handler
 * Manages the customer sales conversation flow
 */
const salesFlow = {
  name: 'sales',
  description: 'Sales inquiry and product information flow',

  /**
   * Check if message should trigger sales flow
   */
  shouldStart: (message) => {
    const keywords = ['buy', 'price', 'product', 'interested', 'quote', 'cost', 'available', 'purchase'];
    const lowerMessage = message.toLowerCase();
    return keywords.some((keyword) => lowerMessage.includes(keyword));
  },

  /**
   * Flow steps
   */
  steps: {
    /**
     * Step 0: Welcome message
     */
    0: async (userMessage, sessionContext) => {
      return {
        response: '🛍️ Welcome! I\'d be happy to help you with our products. What are you interested in?',
        nextStep: 1,
        context: {
          inquiryType: null,
        },
      };
    },

    /**
     * Step 1: Identify product interest
     */
    1: async (userMessage, sessionContext) => {
      const lowerMessage = userMessage.toLowerCase();

      let inquiryType = 'general';
      if (lowerMessage.includes('premium') || lowerMessage.includes('pro')) {
        inquiryType = 'premium';
      } else if (lowerMessage.includes('starter') || lowerMessage.includes('basic')) {
        inquiryType = 'starter';
      } else if (lowerMessage.includes('enterprise') || lowerMessage.includes('custom')) {
        inquiryType = 'enterprise';
      }

      logger.info(`Sales flow step 1: Inquiry type identified - ${inquiryType}`);

      return {
        response: `Great! I see you're interested in our ${inquiryType} offering. Let me connect you with a sales representative who can provide detailed information.`,
        nextStep: 2,
        context: {
          inquiryType,
        },
      };
    },

    /**
     * Step 2: Collect contact information
     */
    2: async (userMessage, sessionContext) => {
      return {
        response: 'Could you please provide your email address so a sales team member can contact you?',
        nextStep: 3,
        context: {
          email: null,
        },
      };
    },

    /**
     * Step 3: Confirm and close flow
     */
    3: async (userMessage, sessionContext) => {
      const email = userMessage;

      logger.info(`Sales flow completed`, {
        email,
        inquiryType: sessionContext.context.inquiryType,
      });

      return {
        response: `Thank you! I've recorded your email (${email}). Our sales team will contact you within 24 hours with detailed information about our products. Is there anything else I can help you with?`,
        nextStep: null,
        context: {
          email,
          flowCompleted: true,
        },
        shouldResetFlow: true,
      };
    },
  },
};

module.exports = salesFlow;
