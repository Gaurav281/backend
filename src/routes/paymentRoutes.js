const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const { protect, verifiedOnly } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const Payment = require('../models/Payment');
const User = require('../models/User');

// =======================
// VALIDATION
// =======================
const paymentValidation = [
  body('serviceId')
    .notEmpty().withMessage('Service ID is required')
    .isMongoId().withMessage('Invalid Service ID'),
  body('transactionId')
    .notEmpty().withMessage('Transaction ID is required')
    .trim(),
  body('paymentType')
    .optional()
    .isIn(['full', 'installment'])
    .withMessage('Payment type must be "full" or "installment"')
];

const installmentValidation = [
  body('installmentNumber')
    .isInt({ min: 1 }).withMessage('Valid installment number required'),
  body('transactionId')
    .notEmpty().withMessage('Transaction ID is required')
    .trim()
];

// =======================
// USER ROUTES
// =======================
// Create payment
router.post(
  '/',
  protect,
  verifiedOnly,
  paymentValidation,
  paymentController.createPayment
);

// Choose payment type (for display purposes only)
router.post(
  '/choose-type',
  protect,
  verifiedOnly,
  [
    body('serviceId').isMongoId().withMessage('Invalid Service ID'),
    body('paymentType').isIn(['full', 'installment']).withMessage('Invalid payment type')
  ],
  paymentController.choosePaymentType
);

// Pay installment
router.post(
  '/:paymentId/pay-installment',
  protect,
  verifiedOnly,
  installmentValidation,
  paymentController.payInstallment
);

// Get user payments
router.get(
  '/',
  protect,
  verifiedOnly,
  paymentController.getUserPayments
);

// Get payment details with installments
router.get(
  '/:id/details',
  protect,
  paymentController.getPaymentDetails
);

// Get QR code for payment
router.get(
  '/qr/:serviceId',
  protect,
  verifiedOnly,
  paymentController.generatePaymentQR
);

// Get single payment
router.get(
  '/:id',
  protect,
  paymentController.getPayment
);

// Mark service as complete
router.patch(
  '/:id/complete',
  protect,
  paymentController.markServiceComplete
);

// =======================
// ADMIN ROUTES
// =======================
// Update payment status
router.patch(
  '/admin/:id/status',
  protect,
  adminOnly,
  [
    body('status')
      .isIn(['pending', 'approved', 'rejected'])
      .withMessage('Status must be pending, approved, or rejected'),
    body('notes').optional().trim()
  ],
  paymentController.updatePaymentStatus
);

// Send payment notification (email)
router.post(
  '/admin/:id/notify',
  protect,
  adminOnly,
  [
    body('status')
      .optional()
      .isIn(['pending', 'approved', 'rejected'])
      .withMessage('Status must be pending, approved, or rejected')
  ],
  async (req, res) => {
    try {
      const payment = await Payment.findById(req.params.id)
        .populate('userId', 'name email')
        .populate('serviceId', 'name');
      
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }
      
      const { status } = req.body;
      const notificationStatus = status || payment.paymentStatus;
      
      // In a real app, you would send an email here
      // For now, we'll just return a success message
      
      res.json({
        success: true,
        message: `Notification sent for payment ${notificationStatus}`,
        data: {
          paymentId: payment._id,
          userId: payment.userId._id,
          userEmail: payment.userId.email,
          status: notificationStatus
        }
      });
    } catch (error) {
      console.error('Send Notification Error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// Check for overdue payments
router.get(
  '/admin/check-overdue',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const now = new Date();
      
      // Find payments with overdue installments
      const payments = await Payment.find({
        paymentType: 'installment',
        'installments.status': 'pending',
        'installments.dueDate': { $lt: now },
        markedSuspicious: false
      }).populate('userId', 'name email');
      
      const suspiciousUsers = [];
      
      for (const payment of payments) {
        if (payment.userId && !payment.userId.isSuspicious) {
          // Mark user as suspicious
          payment.userId.isSuspicious = true;
          payment.userId.installmentSettings.enabled = false;
          await payment.userId.save();
          
          // Mark payment as suspicious
          payment.markedSuspicious = true;
          await payment.save();
          
          suspiciousUsers.push({
            userId: payment.userId._id,
            email: payment.userId.email,
            name: payment.userId.name,
            paymentId: payment._id
          });
        }
      }
      
      res.json({
        success: true,
        message: `Marked ${suspiciousUsers.length} users as suspicious`,
        suspiciousUsers
      });
    } catch (error) {
      console.error('Check Overdue Payments Error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// Get payment stats
router.get(
  '/admin/stats',
  protect,
  adminOnly,
  paymentController.getPaymentStats
);

// Delete payment (admin only)
router.delete(
  '/admin/:id',
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const payment = await Payment.findById(req.params.id);
      
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }
      
      // Remove from user's enrolled services
      await User.findByIdAndUpdate(payment.userId, {
        $pull: { enrolledServices: payment._id }
      });
      
      await payment.deleteOne();
      
      res.json({
        success: true,
        message: 'Payment deleted successfully'
      });
    } catch (error) {
      console.error('Delete Payment Error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

module.exports = router;