const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Profile routes
router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('socialMedia').optional().isArray().withMessage('Social media must be an array'),
  body('socialMedia.*.platform').optional().isIn([
    'facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'other'
  ]),
  body('socialMedia.*.url').optional().isURL().withMessage('Invalid URL')
], userController.updateProfile);

// Password routes
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], userController.changePassword);

// Service routes
router.get('/services', protect, userController.getEnrolledServices);
router.patch('/services/:id/complete', protect, userController.markServiceComplete);

// Dashboard
router.get('/dashboard', protect, userController.getDashboardStats);

// Account management
router.delete('/account', protect, userController.deleteAccount);

module.exports = router;