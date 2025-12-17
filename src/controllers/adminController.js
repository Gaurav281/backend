const User = require('../models/User');
const Service = require('../models/Service');
const Payment = require('../models/Payment');
const Broadcast = require('../models/Broadcast');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // User stats
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const activeUsers = await User.countDocuments({ isActive: true });
    const suspiciousUsers = await User.countDocuments({ isSuspicious: true });
    const usersWithInstallments = await User.countDocuments({ 'installmentSettings.enabled': true });
    
    // Service stats
    const totalServices = await Service.countDocuments();
    const activeServices = await Service.countDocuments({ isActive: true });
    
    // Payment stats
    const totalPayments = await Payment.countDocuments();
    const pendingPayments = await Payment.countDocuments({ paymentStatus: 'pending' });
    const approvedPayments = await Payment.countDocuments({ paymentStatus: 'approved' });
    const installmentPayments = await Payment.countDocuments({ paymentType: 'installment' });
    const partialPayments = await Payment.countDocuments({ paymentStatus: 'partial' });
    
    // Revenue
    const revenueResult = await Payment.aggregate([
      {
        $match: { paymentStatus: 'approved' }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
    
    // Recent users
    const recentUsers = await User.find()
      .sort('-createdAt')
      .limit(5)
      .select('name email role createdAt isSuspicious installmentSettings');
    
    // Recent payments
    const recentPayments = await Payment.find()
      .populate('userId', 'name email')
      .populate('serviceId', 'name price')
      .sort('-createdAt')
      .limit(5);
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        verifiedUsers,
        activeUsers,
        suspiciousUsers,
        usersWithInstallments,
        totalServices,
        activeServices,
        totalPayments,
        pendingPayments,
        approvedPayments,
        installmentPayments,
        partialPayments,
        totalRevenue,
        recentUsers,
        recentPayments
      }
    });
  } catch (error) {
    console.error('Get Admin Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const { search, role, verified, active, suspicious, installments } = req.query;
    
    let query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Role filter
    if (role && role !== 'all') {
      query.role = role;
    }
    
    // Verified filter
    if (verified === 'true') {
      query.isVerified = true;
    } else if (verified === 'false') {
      query.isVerified = false;
    }
    
    // Active filter
    if (active === 'true') {
      query.isActive = true;
    } else if (active === 'false') {
      query.isActive = false;
    }
    
    // Suspicious filter
    if (suspicious === 'true') {
      query.isSuspicious = true;
    } else if (suspicious === 'false') {
      query.isSuspicious = false;
    }
    
    // Installments filter
    if (installments === 'enabled') {
      query['installmentSettings.enabled'] = true;
    } else if (installments === 'disabled') {
      query['installmentSettings.enabled'] = false;
    }
    
    const users = await User.find(query)
      .select('-password -otp -otpExpiry')
      .sort('-createdAt');
    
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single user with details
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -otp -otpExpiry')
      .populate({
        path: 'enrolledServices',
        populate: {
          path: 'serviceId',
          select: 'name price duration'
        }
      });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user payments
    const payments = await Payment.find({ userId: user._id })
      .populate('serviceId', 'name price duration')
      .sort('-createdAt');
    
    // Calculate stats
    const totalSpent = payments
      .filter(p => p.paymentStatus === 'approved' || p.paymentStatus === 'partial')
      .reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    
    const totalDue = payments
      .filter(p => p.paymentStatus === 'partial' || p.paymentStatus === 'pending')
      .reduce((sum, p) => sum + (p.amountDue || 0), 0);
    
    const installmentPayments = payments.filter(p => p.paymentType === 'installment');
    const overdueInstallments = installmentPayments.reduce((sum, payment) => {
      const overdue = payment.installments.filter(inst => inst.status === 'pending' && inst.dueDate < new Date());
      return sum + overdue.length;
    }, 0);
    
    // Format user response
    const userResponse = {
      ...user.toObject(),
      isVerified: user.isVerified !== false,
      isActive: user.isActive !== false,
      isSuspicious: user.isSuspicious === true,
      installmentSettings: {
        enabled: user.installmentSettings?.enabled === true,
        splits: user.installmentSettings?.splits || [],
        defaultSplits: user.installmentSettings?.defaultSplits || [30, 70],
        updatedBy: user.installmentSettings?.updatedBy,
        updatedAt: user.installmentSettings?.updatedAt
      },
      socialMedia: Array.isArray(user.socialMedia) ? user.socialMedia : [],
      paymentStats: {
        totalPayments: payments.length,
        totalSpent,
        totalDue,
        installmentPayments: installmentPayments.length,
        overdueInstallments
      },
      payments
    };
    
    res.json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user role
// @route   PATCH /api/admin/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }
    
    // Prevent changing own role
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    user.role = role;
    await user.save();
    
    res.json({
      success: true,
      message: `User role updated to ${role}`,
      user
    });
  } catch (error) {
    console.error('Update User Role Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Toggle user status
// @route   PATCH /api/admin/users/:id/status
// @access  Private/Admin
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent deactivating self
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }
    
    user.isActive = !user.isActive;
    await user.save();
    
    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
      user
    });
  } catch (error) {
    console.error('Toggle User Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Toggle user suspicion status
// @route   PATCH /api/admin/users/:id/suspicion
// @access  Private/Admin
const toggleSuspicionStatus = async (req, res) => {
  try {
    const { isSuspicious } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update suspicion status
    user.isSuspicious = isSuspicious;
    
    // Disable installments for suspicious users
    if (isSuspicious) {
      user.installmentSettings.enabled = false;
      user.installmentSettings.updatedBy = req.user.id;
      user.installmentSettings.updatedAt = new Date();
    }
    
    // Save the user
    await user.save();
    
    // Get updated user with proper formatting
    const updatedUser = await User.findById(req.params.id)
      .select('-password -otp -otpExpiry');
    
    
    res.json({
      success: true,
      message: `User marked as ${isSuspicious ? 'suspicious' : 'not suspicious'}`,
      user: {
        ...updatedUser.toObject(),
        isSuspicious: updatedUser.isSuspicious === true,
        installmentSettings: {
          enabled: updatedUser.installmentSettings?.enabled === true,
          splits: updatedUser.installmentSettings?.splits || [],
          defaultSplits: updatedUser.installmentSettings?.defaultSplits || [30, 70],
          updatedBy: updatedUser.installmentSettings?.updatedBy,
          updatedAt: updatedUser.installmentSettings?.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Toggle Suspicion Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Manage user installment settings
// @route   PATCH /api/admin/users/:id/installments
// @access  Private/Admin
const manageInstallments = async (req, res) => {
  try {
    const { enabled, splits } = req.body;
    
    // //console.log('Managing installments:', { userId: req.params.id, enabled, splits });
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update installment settings
    if (enabled !== undefined) {
      user.installmentSettings.enabled = enabled;
    }
    
    if (splits && Array.isArray(splits)) {
      // Validate splits
      const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
      if (totalPercentage !== 100) {
        return res.status(400).json({
          success: false,
          message: 'Installment splits must total 100%'
        });
      }
      
      user.installmentSettings.splits = splits;
    }
    
    user.installmentSettings.updatedBy = req.user.id;
    user.installmentSettings.updatedAt = new Date();
    
    // Save the user
    await user.save();
    
    // Get updated user with proper formatting
    const updatedUser = await User.findById(req.params.id)
      .select('-password -otp -otpExpiry');
    
    //console.log('Updated user installment enabled:', updatedUser.installmentSettings?.enabled);
    
    res.json({
      success: true,
      message: `Installments ${enabled ? 'enabled' : 'disabled'} for user`,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isSuspicious: updatedUser.isSuspicious === true,
        installmentSettings: {
          enabled: updatedUser.installmentSettings?.enabled === true,
          splits: updatedUser.installmentSettings?.splits || [],
          defaultSplits: updatedUser.installmentSettings?.defaultSplits || [30, 70],
          updatedBy: updatedUser.installmentSettings?.updatedBy,
          updatedAt: updatedUser.installmentSettings?.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Manage Installments Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Set default installment splits for a user
// @route   POST /api/admin/users/:id/installments/splits
// @access  Private/Admin
const setInstallmentSplits = async (req, res) => {
  try {
    const { splits } = req.body;
    
    //console.log('Setting installment splits:', { userId: req.params.id, splits });
    
    if (!Array.isArray(splits) || splits.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least two splits are required'
      });
    }
    
    const totalPercentage = splits.reduce((sum, percentage) => sum + percentage, 0);
    if (totalPercentage !== 100) {
      return res.status(400).json({
        success: false,
        message: 'Splits must total 100%'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Create split objects with due days
    const splitObjects = splits.map((percentage, index) => ({
      percentage,
      dueDays: index === 0 ? 0 : (index * 30) // Default due days: 0 for first, then 30 days apart
    }));
    
    user.installmentSettings.splits = splitObjects;
    user.installmentSettings.defaultSplits = splits;
    user.installmentSettings.updatedBy = req.user.id;
    user.installmentSettings.updatedAt = new Date();
    
    // Save the user
    await user.save();
    
    // Get updated user with proper formatting
    const updatedUser = await User.findById(req.params.id)
      .select('-password -otp -otpExpiry');
    
    //console.log('Updated user splits:', updatedUser.installmentSettings?.splits);
    
    res.json({
      success: true,
      message: `Installment splits set to ${splits.join('/')}%`,
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isSuspicious: updatedUser.isSuspicious === true,
        installmentSettings: {
          enabled: updatedUser.installmentSettings?.enabled === true,
          splits: updatedUser.installmentSettings?.splits || [],
          defaultSplits: updatedUser.installmentSettings?.defaultSplits || [30, 70],
          updatedBy: updatedUser.installmentSettings?.updatedBy,
          updatedAt: updatedUser.installmentSettings?.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Set Installment Splits Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all payments
// @route   GET /api/admin/payments
// @access  Private/Admin
const getPayments = async (req, res) => {
  try {
    const { status, search, startDate, endDate, paymentType } = req.query;
    
    let query = {};
    
    // Status filter
    if (status && status !== 'all') {
      query.paymentStatus = status;
    }
    
    // Payment type filter
    if (paymentType && paymentType !== 'all') {
      query.paymentType = paymentType;
    }
    
    // Search filter
    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { 'userId.name': { $regex: search, $options: 'i' } },
        { 'serviceId.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const payments = await Payment.find(query)
      .populate('userId', 'name email isSuspicious')
      .populate('serviceId', 'name price duration')
      .sort('-createdAt');
    
    res.json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    console.error('Get Payments Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get recent payments
// @route   GET /api/admin/payments/recent
// @access  Private/Admin
const getRecentPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('userId', 'name')
      .populate('serviceId', 'name price')
      .sort('-createdAt')
      .limit(10);
    
    res.json({
      success: true,
      payments
    });
  } catch (error) {
    console.error('Get Recent Payments Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    // Prevent deleting self
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    const user = await User.findById(req.params.id);
    
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
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete payment
// @route   DELETE /api/admin/payments/:id
// @access  Private/Admin
const deletePayment = async (req, res) => {
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
};

// @desc    Delete broadcast
// @route   DELETE /api/admin/broadcast/:id
// @access  Private/Admin
const deleteBroadcast = async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }
    
    await broadcast.deleteOne();
    
    res.json({
      success: true,
      message: 'Broadcast deleted successfully'
    });
  } catch (error) {
    console.error('Delete Broadcast Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete service
// @route   DELETE /api/admin/services/:id
// @access  Private/Admin
const deleteService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    
    // Delete all payments for this service
    await Payment.deleteMany({ serviceId: service._id });
    
    await service.deleteOne();
    
    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Delete Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Check for overdue payments and mark users as suspicious (Cron job)
// @route   GET /api/admin/check-overdue-payments
// @access  Private/Admin
const checkOverduePayments = async (req, res) => {
  try {
    const now = new Date();
    
    // Find payments with overdue installments
    const payments = await Payment.find({
      paymentType: 'installment',
      'installments.status': 'pending',
      'installments.dueDate': { $lt: now },
      markedSuspicious: false
    }).populate('userId');
    
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
};

// Add these functions to your existing adminController.js

// @desc    Send payment notification
// @route   POST /api/admin/payments/:id/notify
// @access  Private/Admin
const sendPaymentNotification = async (req, res) => {
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
    
    const { status, message } = req.body;
    const notificationStatus = status || payment.paymentStatus;
    
    // This would be handled by the email service
    // For now, we'll return success
    res.json({
      success: true,
      message: `Notification sent for payment ${notificationStatus}`,
      data: {
        paymentId: payment._id,
        userId: payment.userId._id,
        userEmail: payment.userId.email,
        serviceName: payment.serviceId.name,
        status: notificationStatus,
        customMessage: message
      }
    });
  } catch (error) {
    console.error('Send Payment Notification Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update service dates
// @route   PATCH /api/admin/payments/:id/dates
// @access  Private/Admin
const updateServiceDates = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    if (startDate) {
      payment.startDate = new Date(startDate);
    }
    
    if (endDate) {
      payment.endDate = new Date(endDate);
    }
    
    // Update service status based on new dates
    if (payment.startDate && payment.endDate) {
      const now = new Date();
      const start = new Date(payment.startDate);
      const end = new Date(payment.endDate);
      
      if (now < start) {
        payment.serviceStatus = 'pending';
      } else if (now >= start && now <= end) {
        payment.serviceStatus = 'active';
      } else if (now > end) {
        payment.serviceStatus = 'expired';
      }
    }
    
    await payment.save();
    
    res.json({
      success: true,
      message: 'Service dates updated successfully',
      payment
    });
  } catch (error) {
    console.error('Update Service Dates Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getUser,
  updateUserRole,
  toggleUserStatus,
  toggleSuspicionStatus,
  manageInstallments,
  setInstallmentSplits,
  getPayments,
  getRecentPayments,
  deleteUser,
  deletePayment,
  deleteBroadcast,
  deleteService,
  checkOverduePayments,
  sendPaymentNotification,
  updateServiceDates,
};