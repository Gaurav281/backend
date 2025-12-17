// backend/src/routes/broadcastRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const broadcastController = require('../controllers/broadcastController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

// Validation middleware
const broadcastValidation = [
  body('message').notEmpty().withMessage('Message is required').trim().isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('expiresAt').optional().isISO8601().withMessage('expiresAt must be a valid date')
];

// Public routes
router.get('/', broadcastController.getBroadcasts);
router.get('/active', broadcastController.getActiveBroadcast);

// Admin routes (protected and admin only)
router.get('/admin/broadcast', protect, adminOnly, broadcastController.getAllBroadcasts);
router.post('/admin/broadcast', protect, adminOnly, broadcastValidation, broadcastController.createBroadcast);
router.put('/admin/broadcast/:id', protect, adminOnly, broadcastValidation, broadcastController.updateBroadcast);
router.delete('/admin/broadcast/:id', protect, adminOnly, broadcastController.deleteBroadcast);
router.patch('/admin/broadcast/:id/status', protect, adminOnly, broadcastController.toggleBroadcastStatus);

module.exports = router;