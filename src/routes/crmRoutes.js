const express = require('express');
const router = express.Router();
const { authMiddleware, roleGuard } = require('../middleware/authMiddleware');
const crm = require('../controllers/crmController');

// ─── Public ───────────────────────────────────────────────
// Google OAuth callback — exchange Google token for session
router.post('/auth/google', crm.googleAuth);

// ─── Protected (operador + administrador) ─────────────────
router.use(authMiddleware);

// Dashboard
router.get('/reports/summary', crm.getReportSummary);
router.get('/reports/deliveries', crm.getTodayDeliveries);

// Orders
router.get('/orders', crm.getOrders);
router.get('/orders/:id', crm.getOrder);
router.put('/orders/:id/status', crm.updateOrderStatus);

// Clients
router.get('/clients', crm.getClients);
router.get('/clients/:id', crm.getClient);

// ─── Admin only ───────────────────────────────────────────
router.use(roleGuard('administrador'));

// Products
router.get('/products', crm.getProducts);
router.post('/products', crm.createProduct);
router.put('/products/:id', crm.updateProduct);
router.delete('/products/:id', crm.deleteProduct);

// Subscriptions
router.get('/subscriptions', crm.getSubscriptions);
router.post('/subscriptions', crm.createSubscription);
router.put('/subscriptions/:id', crm.updateSubscription);

// Operators
router.get('/operators', crm.getOperators);
router.post('/operators', crm.createOperator);

// Config
router.get('/config/operating-hours', crm.getOperatingHours);
router.put('/config/operating-hours', crm.updateOperatingHours);
router.get('/config/delivery-zones', crm.getDeliveryZones);
router.post('/config/delivery-zones', crm.createDeliveryZone);
router.put('/config/delivery-zones/:id', crm.updateDeliveryZone);

module.exports = router;
