const logger = require('../config/logger');
const AppError = require('../utils/AppError');

/**
 * Flow Service - Orchestrates different conversation flows
 */
class FlowService {
  constructor() {
    this.flows = {};
  }

  /**
   * Register a flow
   */
  registerFlow(flowName, flowHandler) {
    if (this.flows[flowName]) {
      logger.warn(`Flow '${flowName}' is being overwritten`);
    }
    this.flows[flowName] = flowHandler;
    logger.info(`Flow '${flowName}' registered`);
  }

  /**
   * Execute a flow step
   */
  async executeFlowStep(flowName, step, userMessage, sessionContext) {
    try {
      const flow = this.flows[flowName];

      if (!flow) {
        throw new AppError(`Flow '${flowName}' not found`, 404);
      }

      if (!flow.steps || !flow.steps[step]) {
        throw new AppError(`Step ${step} not found in flow '${flowName}'`, 404);
      }

      const handler = flow.steps[step];
      const result = await handler(userMessage, sessionContext);

      return result;
    } catch (error) {
      logger.error(`Failed to execute flow step: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get next step in flow
   */
  async getNextStep(flowName, currentStep) {
    try {
      const flow = this.flows[flowName];

      if (!flow) {
        throw new AppError(`Flow '${flowName}' not found`, 404);
      }

      const nextStep = (currentStep || 0) + 1;

      if (!flow.steps[nextStep]) {
        // Flow is complete
        return null;
      }

      return nextStep;
    } catch (error) {
      logger.error(`Failed to get next step: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if message should start a specific flow
   */
  async shouldStartFlow(flowName, userMessage) {
    try {
      const flow = this.flows[flowName];

      if (!flow || !flow.shouldStart) {
        return false;
      }

      return flow.shouldStart(userMessage);
    } catch (error) {
      logger.error(`Failed to check flow trigger: ${error.message}`);
      return false;
    }
  }

  /**
   * Get list of available flows
   */
  getAvailableFlows() {
    return Object.keys(this.flows);
  }
}

module.exports = new FlowService();
