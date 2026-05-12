const { Session, User } = require('../models');
const logger = require('../config/logger');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Session Service - Manages user sessions and flow states
 */
class SessionService {
  /**
   * Get or create session for user
   */
  async getOrCreateSession(userId) {
    try {
      let session = await Session.findOne({
        where: { user_id: userId },
      });

      if (!session) {
        session = await Session.create({
          user_id: userId,
          current_flow: 'idle',
          flow_step: 0,
          context: {},
          expires_at: new Date(Date.now() + env.SESSION_TIMEOUT * 1000),
        });
      }

      return session;
    } catch (error) {
      logger.error(`Failed to get/create session: ${error.message}`);
      throw new AppError('Failed to get session', 500);
    }
  }

  /**
   * Update current flow
   */
  async updateFlow(userId, flowName, flowStep = 0, context = {}) {
    try {
      const session = await Session.findOne({
        where: { user_id: userId },
      });

      if (!session) {
        throw new AppError('Session not found', 404);
      }

      await session.update({
        current_flow: flowName,
        flow_step: flowStep,
        context: {
          ...session.context,
          ...context,
        },
        expires_at: new Date(Date.now() + env.SESSION_TIMEOUT * 1000),
      });

      logger.info(`Session updated for user ${userId}`, {
        flow: flowName,
        step: flowStep,
      });

      return session;
    } catch (error) {
      logger.error(`Failed to update flow: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get session context
   */
  async getSessionContext(userId) {
    try {
      const session = await Session.findOne({
        where: { user_id: userId },
      });

      if (!session) {
        return null;
      }

      return {
        userId,
        currentFlow: session.current_flow,
        flowStep: session.flow_step,
        context: session.context,
      };
    } catch (error) {
      logger.error(`Failed to get session context: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear session (reset to idle)
   */
  async clearSession(userId) {
    try {
      const session = await Session.findOne({
        where: { user_id: userId },
      });

      if (session) {
        await session.update({
          current_flow: 'idle',
          flow_step: 0,
          context: {},
        });
      }

      return session;
    } catch (error) {
      logger.error(`Failed to clear session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean expired sessions
   */
  async cleanExpiredSessions() {
    try {
      const result = await Session.destroy({
        where: {
          expires_at: {
            [require('sequelize').Op.lt]: new Date(),
          },
        },
      });

      logger.info(`Cleaned ${result} expired sessions`);
      return result;
    } catch (error) {
      logger.error(`Failed to clean expired sessions: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SessionService();
