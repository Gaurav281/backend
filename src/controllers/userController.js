const User = require('../models/User');
const Payment = require('../models/Payment');
const { validationResult } = require('express-validator');

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -otp -otpExpiry -resetPasswordToken -resetPasswordExpire');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // IMPORTANT: Format the response exactly like auth/me endpoint
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified !== false,
      isActive: user.isActive !== false,
      isSuspicious: user.isSuspicious === true, // Strict comparison
      installmentSettings: {
        enabled: user.installmentSettings?.enabled === true, // Strict comparison
        splits: user.installmentSettings?.splits || [],
        defaultSplits: user.installmentSettings?.defaultSplits || [30, 70],
        updatedBy: user.installmentSettings?.updatedBy,
        updatedAt: user.installmentSettings?.updatedAt
      },
      socialMedia: Array.isArray(user.socialMedia) 
        ? user.socialMedia.filter(sm => sm && sm.url && sm.url.trim() !== '')
        : [],
      enrolledServices: user.enrolledServices || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    // console.log('Profile endpoint returning:', {
    //   id: userResponse._id,
    //   isSuspicious: userResponse.isSuspicious,
    //   installmentEnabled: userResponse.installmentSettings.enabled,
    //   socialMediaCount: userResponse.socialMedia.length
    // });
    
    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
// In userController.js - updateProfile function
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, socialMedia } = req.body;

    // Build update object
    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (socialMedia) {
      // Validate and sanitize social media
      const validSocialMedia = socialMedia
        .filter(sm => sm && sm.url && sm.url.trim() !== '')
        .map(sm => ({
          platform: sm.platform || 'other',
          url: sm.url.trim()
        }));
      updateFields.socialMedia = validSocialMedia;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry -resetPasswordToken -resetPasswordExpire');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        ...user.toObject(),
        isVerified: user.isVerified !== false,
        isActive: user.isActive !== false,
        isSuspicious: user.isSuspicious === true,
        installmentSettings: {
          enabled: user.installmentSettings?.enabled === true,
          splits: user.installmentSettings?.splits || [],
          defaultSplits: user.installmentSettings?.defaultSplits || [30, 70],
          ...user.installmentSettings
        },
        socialMedia: Array.isArray(user.socialMedia) ? user.socialMedia : []
      }
    });
  } catch (error) {
    console.error('Update Profile Error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Change password
// @route   PUT /api/user/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get enrolled services
// @route   GET /api/user/services
// @access  Private
const getEnrolledServices = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate('serviceId', 'name description price duration features')
      .sort('-createdAt');

    // Format response
    const services = payments.map(payment => ({
      paymentId: payment._id,
      service: payment.serviceId,
      paymentStatus: payment.paymentStatus,
      serviceStatus: payment.serviceStatus,
      paymentType: payment.paymentType,
      amountPaid: payment.amountPaid,
      amountDue: payment.amountDue,
      installments: payment.installments,
      startDate: payment.startDate,
      endDate: payment.endDate,
      isServiceCompleted: payment.isServiceCompleted
    }));

    res.json({
      success: true,
      count: services.length,
      services
    });
  } catch (error) {
    console.error('Get Enrolled Services Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Mark service as completed
// @route   PATCH /api/user/services/:id/complete
// @access  Private
const markServiceComplete = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check if user owns this service
    if (payment.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    payment.isServiceCompleted = true;
    payment.serviceStatus = 'completed';
    await payment.save();

    res.json({
      success: true,
      message: 'Service marked as completed',
      payment
    });
  } catch (error) {
    console.error('Mark Service Complete Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/user/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id });

    const stats = {
      totalServices: payments.length,
      activeServices: payments.filter(p => p.serviceStatus === 'active').length,
      pendingPayments: payments.filter(p => p.paymentStatus === 'pending').length,
      completedServices: payments.filter(p => p.serviceStatus === 'completed' || p.isServiceCompleted).length,
      totalSpent: payments
        .filter(p => p.paymentStatus === 'approved')
        .reduce((sum, p) => sum + p.amountPaid, 0),
      upcomingInstallments: payments
        .filter(p => p.paymentType === 'installment')
        .reduce((sum, p) => {
          const pendingInst = p.installments.filter(i => i.status === 'pending');
          return sum + pendingInst.length;
        }, 0)
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/user/account
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete all user payments
    await Payment.deleteMany({ userId: user._id });

    // Delete user
    await user.deleteOne();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete Account Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getEnrolledServices,
  markServiceComplete,
  getDashboardStats,
  deleteAccount
};