const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const serviceController = require('../controllers/serviceController');
const broadcastController = require('../controllers/broadcastController');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const User = require('../models/User');

// All routes are protected and admin only
router.use(protect, adminOnly);

// Dashboard stats
router.get('/stats', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id/role', adminController.updateUserRole);
router.patch('/users/:id/status', adminController.toggleUserStatus);
router.patch('/users/:id/suspicion', adminController.toggleSuspicionStatus);

// Installment management
router.patch('/users/:id/installments', [
  body('enabled').optional().isBoolean(),
  body('splits').optional().isArray()
], adminController.manageInstallments);

router.post('/users/:id/installments/splits', [
  body('splits').isArray().withMessage('Splits must be an array'),
  body('splits.*').isInt({ min: 1, max: 100 }).withMessage('Each split must be between 1-100%')
], adminController.setInstallmentSplits);

// Payment management
router.get('/payments', adminController.getPayments);
router.get('/payments/recent', adminController.getRecentPayments);
router.patch('/payments/:id/status', paymentController.updatePaymentStatus);
router.get('/check-overdue-payments', adminController.checkOverduePayments);

// Delete operations
router.delete('/users/:id', adminController.deleteUser);
router.delete('/payments/:id', adminController.deletePayment);
router.delete('/broadcast/:id', adminController.deleteBroadcast);
router.delete('/services/:id', adminController.deleteService);

// Service management
router.get('/services', serviceController.getAdminServices);
router.post('/services', [
  body('name').notEmpty().withMessage('Service name is required').trim(),
  body('description').notEmpty().withMessage('Description is required').trim(),
  body('category').isIn(['saas', 'social', 'seo', 'web', 'marketing', 'other']).withMessage('Invalid category'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('duration').notEmpty().withMessage('Duration is required').trim()
], serviceController.createService);

// Broadcast management
router.get('/broadcast', broadcastController.getAllBroadcasts);
router.post('/broadcast', [
  body('message').notEmpty().withMessage('Message is required').trim(),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high')
], broadcastController.createBroadcast);

// Add these routes to your existing adminRoutes.js

// Payment notification
router.post('/payments/:id/notify', [
  body('status').optional().isIn(['pending', 'approved', 'rejected']),
  body('message').optional().trim()
], adminController.sendPaymentNotification);

// Update service dates
router.patch('/payments/:id/dates', [
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601()
], adminController.updateServiceDates);

// Add this route to your adminRoutes.js
router.get('/debug/user/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      rawUser: user.toObject(),
      formatted: {
        isSuspicious: user.isSuspicious,
        isSuspiciousStrict: user.isSuspicious === true,
        installmentEnabled: user.installmentSettings?.enabled,
        installmentEnabledStrict: user.installmentSettings?.enabled === true,
        socialMedia: user.socialMedia,
        socialMediaCount: user.socialMedia?.length || 0
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;