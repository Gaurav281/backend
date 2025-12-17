const Payment = require('../models/Payment');
const Service = require('../models/Service');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Choose payment type
// @route   POST /api/payments/choose-type
// @access  Private
const choosePaymentType = async (req, res) => {
  try {
    const { serviceId, paymentType } = req.body;
    
    if (!['full', 'installment'].includes(paymentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment type'
      });
    }
    
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    
    // Create payment with chosen type
    const payment = await Payment.create({
      userId: req.user.id,
      serviceId,
      amount: service.price,
      paymentType,
      amountDue: service.price,
      paymentStatus: 'pending'
    });
    
    // If installment, create installments
    if (paymentType === 'installment') {
      const thirtyPercent = service.price * 0.3;
      const seventyPercent = service.price * 0.7;
      
      const now = new Date();
      const endDate = new Date(now);
      
      // Calculate service duration (assuming 30 days by default)
      const duration = service.duration || '30 days';
      if (duration.includes('month')) {
        endDate.setMonth(now.getMonth() + parseInt(duration));
      } else if (duration.includes('year')) {
        endDate.setFullYear(now.getFullYear() + parseInt(duration));
      } else {
        endDate.setDate(now.getDate() + 30);
      }
      
      payment.installments = [
        {
          installmentNumber: 1,
          amount: thirtyPercent,
          dueDate: now,
          status: 'pending'
        },
        {
          installmentNumber: 2,
          amount: seventyPercent,
          dueDate: new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000)), // 7 days before end
          status: 'pending'
        }
      ];
      
      await payment.save();
    }
    
    res.status(201).json({
      success: true,
      message: `Payment type set to ${paymentType}`,
      payment
    });
  } catch (error) {
    console.error('Choose Payment Type Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Pay installment
// @route   POST /api/payments/:id/pay-installment
// @access  Private
const payInstallment = async (req, res) => {
  try {
    const { transactionId, installmentNumber } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Check if user owns this payment
    if (payment.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    if (payment.paymentType !== 'installment') {
      return res.status(400).json({
        success: false,
        message: 'This is not an installment payment'
      });
    }
    
    const installment = payment.installments.find(
      inst => inst.installmentNumber === installmentNumber
    );
    
    if (!installment) {
      return res.status(404).json({
        success: false,
        message: 'Installment not found'
      });
    }
    
    if (installment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Installment already paid'
      });
    }
    
    // Update installment
    installment.status = 'paid';
    installment.paidDate = new Date();
    installment.transactionId = transactionId;
    
    // Check if all installments are paid
    const allPaid = payment.installments.every(inst => inst.status === 'paid');
    if (allPaid) {
      payment.paymentStatus = 'approved';
      payment.serviceStatus = 'active';
      payment.startDate = new Date();
      
      // Calculate end date based on service duration
      const service = await Service.findById(payment.serviceId);
      const endDate = new Date();
      const duration = service.duration || '30 days';
      
      if (duration.includes('month')) {
        endDate.setMonth(endDate.getMonth() + parseInt(duration));
      } else if (duration.includes('year')) {
        endDate.setFullYear(endDate.getFullYear() + parseInt(duration));
      } else {
        endDate.setDate(endDate.getDate() + 30);
      }
      
      payment.endDate = endDate;
    }
    
    await payment.save();
    
    // Add to user's enrolled services if first payment
    if (installmentNumber === 1 && !payment.userId.enrolledServices.includes(payment._id)) {
      await User.findByIdAndUpdate(req.user.id, {
        $push: { enrolledServices: payment._id }
      });
    }
    
    res.json({
      success: true,
      message: 'Installment paid successfully',
      payment
    });
  } catch (error) {
    console.error('Pay Installment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get payment details with installments
// @route   GET /api/payments/:id/details
// @access  Private
const getPaymentDetails = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('serviceId', 'name price duration')
      .populate('userId', 'name email');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Check authorization
    if (payment.userId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Get Payment Details Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Mark user as suspicious or not (Admin only)
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
    
    user.isSuspicious = isSuspicious;
    await user.save();
    
    res.json({
      success: true,
      message: `User marked as ${isSuspicious ? 'suspicious' : 'not suspicious'}`,
      user
    });
  } catch (error) {
    console.error('Toggle Suspicion Error:', error);
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
    const overduePayments = await Payment.find({
      paymentType: 'installment',
      'installments.status': 'pending',
      'installments.dueDate': { $lt: now },
      endDate: { $lt: now },
      paymentStatus: { $ne: 'approved' }
    }).populate('userId');
    
    const suspiciousUsers = [];
    
    for (const payment of overduePayments) {
      if (payment.userId && !payment.userId.isSuspicious) {
        payment.userId.isSuspicious = true;
        await payment.userId.save();
        suspiciousUsers.push(payment.userId._id);
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

module.exports = {
  choosePaymentType,
  payInstallment,
  getPaymentDetails,
  toggleSuspicionStatus,
  checkOverduePayments
};