const logger = require('../../config/logger');

/**
 * Support Flow Handler
 * Manages customer support and troubleshooting flows
 */
const supportFlow = {
  name: 'support',
  description: 'Customer support and troubleshooting flow',

  /**
   * Check if message should trigger support flow
   */
  shouldStart: (message) => {
    const keywords = ['help', 'support', 'problem', 'issue', 'bug', 'error', 'broken', 'not working', 'assistance'];
    const lowerMessage = message.toLowerCase();
    return keywords.some((keyword) => lowerMessage.includes(keyword));
  },

  /**
   * Flow steps
   */
  steps: {
    /**
     * Step 0: Welcome and issue summary
     */
    0: async (userMessage, sessionContext) => {
      return {
        response: '🆘 I\'m here to help! Can you briefly describe the issue you\'re experiencing?',
        nextStep: 1,
        context: {
          issueDescription: null,
        },
      };
    },

    /**
     * Step 1: Categorize issue
     */
    1: async (userMessage, sessionContext) => {
      const lowerMessage = userMessage.toLowerCase();

      let issueCategory = 'general';
      if (lowerMessage.includes('login') || lowerMessage.includes('password') || lowerMessage.includes('account')) {
        issueCategory = 'authentication';
      } else if (lowerMessage.includes('payment') || lowerMessage.includes('billing') || lowerMessage.includes('invoice')) {
        issueCategory = 'billing';
      } else if (lowerMessage.includes('feature') || lowerMessage.includes('functionality') || lowerMessage.includes('how to')) {
        issueCategory = 'functionality';
      }

      logger.info(`Support flow step 1: Issue category identified - ${issueCategory}`);

      return {
        response: `I understand. Let me provide some troubleshooting steps for your ${issueCategory} issue. Have you already tried restarting the application?`,
        nextStep: 2,
        context: {
          issueDescription: userMessage,
          issueCategory,
          troubleshootingAttempts: [],
        },
      };
    },

    /**
     * Step 2: Provide troubleshooting suggestions
     */
    2: async (userMessage, sessionContext) => {
      const lowerMessage = userMessage.toLowerCase();
      const issueCategory = sessionContext.context.issueCategory || 'general';

      let suggestion = '';

      if (lowerMessage.includes('yes') || lowerMessage.includes('already')) {
        suggestion = 'Have you cleared your browser cache and cookies?';
      } else {
        suggestion = 'Let\'s try that first - please restart the application and let me know if the issue persists.';
      }

      return {
        response: suggestion,
        nextStep: 3,
        context: {
          troubleshootingStep: 1,
        },
      };
    },

    /**
     * Step 3: Offer escalation
     */
    3: async (userMessage, sessionContext) => {
      const lowerMessage = userMessage.toLowerCase();

      if (lowerMessage.includes('yes') || lowerMessage.includes('fixed') || lowerMessage.includes('resolved')) {
        logger.info(`Support flow completed - issue resolved`);

        return {
          response: '✅ Great! I\'m glad we could resolve your issue. Is there anything else I can help you with?',
          nextStep: null,
          context: {
            flowCompleted: true,
            issueSolved: true,
          },
          shouldResetFlow: true,
        };
      }

      logger.info(`Support flow - escalation required`);

      return {
        response: 'It seems this requires further investigation. Let me connect you with a support specialist who can assist you better. What\'s the best way to contact you?',
        nextStep: 4,
        context: {
          requiresEscalation: true,
        },
      };
    },

    /**
     * Step 4: Collect contact information for escalation
     */
    4: async (userMessage, sessionContext) => {
      const contactInfo = userMessage;

      logger.info(`Support flow - escalated to specialist`, {
        contactInfo,
        issueCategory: sessionContext.context.issueCategory,
      });

      return {
        response: `Thank you for your patience. A support specialist will reach out to you at ${contactInfo} within 2 hours. We appreciate your cooperation!`,
        nextStep: null,
        context: {
          escalatedContactInfo: contactInfo,
          flowCompleted: true,
        },
        shouldResetFlow: true,
      };
    },
  },
};

module.exports = supportFlow;
