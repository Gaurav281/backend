//backend/src/routes/serviceRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const serviceController = require('../controllers/serviceController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

// Validation middleware
const serviceValidation = [
  body('name').notEmpty().withMessage('Service name is required').trim(),
  body('description').notEmpty().withMessage('Description is required').trim(),
  body('category').isIn(['saas', 'social', 'seo', 'web', 'marketing', 'other']).withMessage('Invalid category'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('duration').notEmpty().withMessage('Duration is required').trim()
];

const updateServiceValidation = [
  body('name').optional().trim(),
  body('description').optional().trim(),
  body('category').optional().isIn(['saas', 'social', 'seo', 'web', 'marketing', 'other']),
  body('price').optional().isFloat({ min: 0 }),
  body('duration').optional().trim()
];


// Public routes
router.get('/', serviceController.getServices);
router.get('/popular', serviceController.getPopularServices);
router.get('/:id', serviceController.getService);
router.get('/related/:id', serviceController.getRelatedServices);

// Protected routes (Admin only)
router.get('/admin/services', protect, adminOnly, serviceController.getAdminServices);
router.post('/admin/services', protect, adminOnly, serviceValidation, serviceController.createService);
router.put('/admin/services/:id', protect, adminOnly, updateServiceValidation, serviceController.updateService);
router.delete('/admin/services/:id', protect, adminOnly, serviceController.deleteService);
router.patch('/admin/services/:id/status', protect, adminOnly, serviceController.toggleServiceStatus);
router.get('/admin/services/stats', protect, adminOnly, serviceController.getServiceStats);

module.exports = router;