const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../config/swagger');

const webhookRoutes = require('./webhookRoutes');
const mercadoPagoRoutes = require('./mercadoPagoRoutes');
const crmRoutes = require('./crmRoutes');
const adminRoutes = require('./adminRoutes');
const operatorRoutes = require('./operatorRoutes');

const router = express.Router();

// Swagger API Documentation (mounted at root/api-docs)
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Webhook routes
router.use('/webhook', webhookRoutes);
router.use('/webhook', mercadoPagoRoutes);

// API routes (CRM, Admin, Operator)
router.use('/api', crmRoutes);
router.use('/api', adminRoutes);
router.use('/api', operatorRoutes);

module.exports = router;
