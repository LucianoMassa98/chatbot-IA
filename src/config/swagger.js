const swaggerJSDoc = require('swagger-jsdoc');
const env = require('./env');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Multichannel Chatbot CRM API',
      version: '1.0.0',
      description: 'API documentation for the CRM, focusing on Conversations and Messages.',
    },
    servers: [
      {
        url: `http://localhost:${env.PORT || 3000}`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Google ID Token',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  // Document CRM, Admin, and Operator routes
  apis: [
    './src/routes/crmRoutes.js',
    './src/routes/adminRoutes.js',
    './src/routes/operatorRoutes.js',
  ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
