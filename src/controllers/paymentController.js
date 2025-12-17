const Payment = require('../models/Payment');
const Service = require('../models/Service');
const User = require('../models/User');
const QRGenerator = require('../utils/qrGenerator');
const emailService = require('../utils/emailService');
const { validationResult } = require('express-validator');

const UPI_ID = process.env.UPI_ID || 'null';

// @desc    Create payment (with installment option check)
// @route   POST /api/payments
// @access  Private
const createPayment = async (req, res) => {
  try {
    // console.log('Payment request body:', req.body);
    // console.log('User ID:', req.user.id);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { serviceId, transactionId, paymentType = 'full' } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!serviceId || !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Service ID and Transaction ID are required'
      });
    }

    // Validate payment type
    if (!['full', 'installment'].includes(paymentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment type. Must be "full" or "installment"'
      });
    }

    // Check user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check service exists and is active
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    if (!service.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Service is not active'
      });
    }

    // Check for duplicate transaction ID
    const existingPayment = await Payment.findOne({ transactionId: transactionId.trim() });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID already used'
      });
    }

    // Check installment eligibility
    if (paymentType === 'installment') {
      if (!user.installmentSettings?.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Installment payments are not enabled for your account'
        });
      }

      // Check if user is suspicious
      if (user.isSuspicious) {
        return res.status(400).json({
          success: false,
          message: 'Your account is marked as suspicious. Cannot use installment payments.'
        });
      }
    }

    // Create payment object
    const paymentData = {
      userId,
      serviceId,
      transactionId: transactionId.trim(),
      amount: service.price,
      paymentMethod: 'upi',
      paymentStatus: paymentType === 'full' ? 'pending' : 'partial', // Full payments: pending, Installments: partial
      serviceStatus: 'pending',
      paymentType: paymentType
    };

    // Create installments if needed
    if (paymentType === 'installment') {
      const splits = user.installmentSettings?.splits?.length > 0
        ? user.installmentSettings.splits
        : [{ percentage: 30, dueDays: 0 }, { percentage: 70, dueDays: 30 }];

      const now = new Date();
      paymentData.installments = splits.map((split, index) => ({
        installmentNumber: index + 1,
        amount: (service.price * split.percentage) / 100,
        percentage: split.percentage,
        dueDate: new Date(now.getTime() + (split.dueDays * 24 * 60 * 60 * 1000)),
        status: 'pending', // All installments start as pending
        transactionId: index === 0 ? transactionId.trim() : null // Only first installment gets transaction ID
      }));

      // First installment is submitted, mark it as submitted (not paid)
      if (paymentData.installments.length > 0) {
        paymentData.installments[0].status = 'submitted'; // Submitted, waiting for admin approval
        paymentData.installments[0].submittedAt = new Date();
        paymentData.amountPaid = 0; // No amount paid yet, waiting for approval
        paymentData.amountDue = service.price; // Full amount is due
      }
    } else {
      // Full payment
      paymentData.amountPaid = 0;
      paymentData.amountDue = service.price;
    }

    // Create payment
    const payment = await Payment.create(paymentData);

    // Add to user's enrolled services
    await User.findByIdAndUpdate(userId, {
      $addToSet: { enrolledServices: payment._id }
    });

    // Update service enrolled count
    await Service.findByIdAndUpdate(serviceId, {
      $inc: { enrolledCount: 1 }
    });

    // console.log('Payment created successfully:', {
    //   paymentId: payment._id,
    //   paymentType: payment.paymentType,
    //   paymentStatus: payment.paymentStatus,
    //   installments: payment.installments?.map(i => ({
    //     number: i.installmentNumber,
    //     status: i.status,
    //     amount: i.amount
    //   }))
    // });

    res.status(201).json({
      success: true,
      message: paymentType === 'installment'
        ? 'First installment submitted successfully. Waiting for admin approval.'
        : 'Payment submitted successfully and pending approval.',
      payment
    });

  } catch (error) {
    console.error('Create Payment Error:', error);

    // Handle specific errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.'
    });
  }
};

// @desc    Choose payment type before payment - UPDATED TO NOT CREATE PAYMENT
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

    // Get user to check installment eligibility
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check if installment is allowed
    let canUseInstallment = false;
    let installmentDetails = null;

    if (paymentType === 'installment') {
      canUseInstallment = user.installmentSettings.enabled;

      if (!canUseInstallment) {
        return res.status(400).json({
          success: false,
          message: 'Installment payments are not enabled for your account. Please contact admin.'
        });
      }

      // Get user's installment splits or use default
      const splits = user.installmentSettings.splits && user.installmentSettings.splits.length > 0
        ? user.installmentSettings.splits
        : [{ percentage: 30, dueDays: 0 }, { percentage: 70, dueDays: 30 }];

      installmentDetails = splits.map((split, index) => ({
        installmentNumber: index + 1,
        amount: (service.price * split.percentage) / 100,
        percentage: split.percentage,
        dueDays: split.dueDays
      }));
    }

    res.json({
      success: true,
      message: `Payment type selected: ${paymentType}`,
      data: {
        paymentType,
        service: {
          _id: service._id,
          name: service.name,
          price: service.price,
          duration: service.duration
        },
        installmentDetails,
        canUseInstallment
      }
    });
  } catch (error) {
    console.error('Choose Payment Type Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Pay installment - FIXED ENDPOINT
// @route   POST /api/payments/:paymentId/pay-installment
// @access  Private
const payInstallment = async (req, res) => {
  try {
    const { transactionId, installmentNumber } = req.body;

    // console.log('Paying installment:', {
    //   paymentId: req.params.paymentId,
    //   installmentNumber,
    //   transactionId
    // });

    const payment = await Payment.findById(req.params.paymentId);
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

    // Find the installment
    const installment = payment.installments.find(
      inst => inst.installmentNumber === installmentNumber
    );

    if (!installment) {
      return res.status(404).json({
        success: false,
        message: 'Installment not found'
      });
    }

    // Check installment status
    if (installment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Installment already paid'
      });
    }

    if (installment.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Installment already approved by admin'
      });
    }

    // For first installment, it should be approved by admin first
    if (installmentNumber === 1 && installment.status === 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'First installment is waiting for admin approval'
      });
    }

    // Update installment
    installment.status = 'submitted'; // Submitted for admin approval
    installment.submittedAt = new Date();
    installment.transactionId = transactionId;

    await payment.save();

    // Get updated payment
    const updatedPayment = await Payment.findById(payment._id)
      .populate('serviceId', 'name price duration')
      .populate('userId', 'name email');

    // console.log('Installment submitted:', {
    //   installmentNumber,
    //   status: installment.status,
    //   transactionId
    // });

    res.json({
      success: true,
      message: `Installment ${installmentNumber} submitted successfully. Waiting for admin approval.`,
      payment: updatedPayment
    });
  } catch (error) {
    console.error('Pay Installment Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get user payments
// @route   GET /api/payments
// @access  Private
const getUserPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate('serviceId', 'name price duration features description')
      .sort('-createdAt');

    res.json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    console.error('Get User Payments Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get payment details
// @route   GET /api/payments/:id
// @access  Private
const getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('serviceId', 'name price duration features description')
      .populate('userId', 'name email');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Check authorization
    if (payment.userId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Get Payment Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get payment details with installments
// @route   GET /api/payments/:id/details
// @access  Private
const getPaymentDetails = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('serviceId', 'name price duration features')
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

    // Calculate summary
    const summary = {
      totalAmount: payment.amount,
      amountPaid: payment.amountPaid,
      amountDue: payment.amountDue,
      paidPercentage: payment.amount > 0 ? (payment.amountPaid / payment.amount) * 100 : 0,
      nextDueDate: payment.nextDueDate,
      daysRemaining: payment.daysRemaining,
      isOverdue: payment.checkOverdueInstallments()
    };

    res.json({
      success: true,
      payment,
      summary
    });
  } catch (error) {
    console.error('Get Payment Details Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Mark service as completed
// @route   PATCH /api/payments/:id/complete
// @access  Private
const markServiceComplete = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user owns this payment
    if (payment.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if payment is approved
    if (payment.paymentStatus !== 'approved' && payment.paymentStatus !== 'partial') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete service with pending payment'
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

// @desc    Generate QR code for payment
// @route   GET /api/payments/qr/:serviceId
// @access  Private
const generatePaymentQR = async (req, res) => {
  try {
    const { amount } = req.query;
    const service = await Service.findById(req.params.serviceId);

    if (!service || !service.isActive) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const paymentAmount = amount || service.price;
    const qrCode = await QRGenerator.generatePaymentQR(
      UPI_ID,
      paymentAmount,
      '5 Star Clips',
      `Service:${service._id}`
    );

    res.json({
      success: true,
      qrCode,
      upiId: UPI_ID,
      amount: paymentAmount,
      service: {
        name: service.name,
        price: service.price
      }
    });
  } catch (error) {
    console.error('Generate QR Error:', error);
    res.status(500).json({ success: false, message: 'QR generation failed' });
  }
};

// @desc    Update payment status (Admin)
// @route   PATCH /api/payments/:id/status
// @access  Private/Admin
const updatePaymentStatus = async (req, res) => {
  try {
    const { status, notes, installmentNumber } = req.body;
    const payment = await Payment.findById(req.params.id)
      .populate('serviceId', 'name duration')
      .populate('userId', 'name email');
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    // Handle installment payments differently
    if (payment.paymentType === 'installment' && installmentNumber !== undefined) {
      // Find the specific installment
      const installment = payment.installments.find(
        inst => inst.installmentNumber === installmentNumber
      );
      
      if (!installment) {
        return res.status(404).json({
          success: false,
          message: 'Installment not found'
        });
      }
      
      // Update installment status
      if (status === 'approved') {
        installment.status = 'paid';
        installment.paidDate = new Date();
        installment.approvedBy = req.user.id;
        installment.approvedAt = new Date();
        
        // Update payment amounts
        payment.amountPaid = (payment.amountPaid || 0) + installment.amount;
        payment.amountDue = payment.amount - payment.amountPaid;
        
        // Check if all installments are paid
        const allInstallmentsPaid = payment.installments.every(
          inst => inst.status === 'paid'
        );
        
        if (allInstallmentsPaid) {
          payment.paymentStatus = 'approved';
          payment.serviceStatus = 'active';
          
          // Set service dates
          const startDate = new Date();
          const endDate = new Date(startDate);
          const duration = payment.serviceId.duration || '30 days';
          
          if (duration.includes('month')) {
            const months = parseInt(duration) || 1;
            endDate.setMonth(startDate.getMonth() + months);
          } else if (duration.includes('year')) {
            const years = parseInt(duration) || 1;
            endDate.setFullYear(startDate.getFullYear() + years);
          } else {
            const days = parseInt(duration) || 30;
            endDate.setDate(startDate.getDate() + days);
          }
          
          payment.startDate = startDate;
          payment.endDate = endDate;
        } else {
          payment.paymentStatus = 'partial';
        }
        
        // If this is the first installment and service hasn't started, start it
        if (installmentNumber === 1 && !payment.startDate) {
          payment.startDate = new Date();
          payment.serviceStatus = 'active';
        }
      } else if (status === 'rejected') {
        installment.status = 'rejected';
        installment.rejectedAt = new Date();
        installment.rejectedBy = req.user.id;
        installment.transactionId = null; // Clear transaction ID for retry
      }
      
      if (notes) {
        installment.notes = notes;
      }
    } else {
      // Handle full payments
      if (status === 'approved' && !payment.startDate) {
        const start = new Date();
        const end = new Date(start);
        const duration = payment.serviceId.duration || '30 days';
        
        if (duration.includes('month')) {
          const months = parseInt(duration) || 1;
          end.setMonth(start.getMonth() + months);
        } else if (duration.includes('year')) {
          const years = parseInt(duration) || 1;
          end.setFullYear(start.getFullYear() + years);
        } else {
          const days = parseInt(duration) || 30;
          end.setDate(start.getDate() + days);
        }
        
        payment.startDate = start;
        payment.endDate = end;
        payment.serviceStatus = 'active';
      }
      
      if (status === 'rejected') {
        payment.serviceStatus = 'expired';
      }
      
      payment.paymentStatus = status;
      if (notes) payment.adminNotes = notes;
    }
    
    await payment.save();
    
    // Send notifications
    if (status === 'approved') {
      await emailService.sendPaymentStatusEmail(
        payment.userId.email,
        payment.userId.name,
        payment.serviceId.name,
        status,
        payment.transactionId
      );
      
      if (payment.paymentType === 'full' || 
          (payment.paymentType === 'installment' && payment.serviceStatus === 'active')) {
        await emailService.sendServiceEnrollmentEmail(
          payment.userId.email,
          payment.userId.name,
          payment.serviceId.name,
          payment.startDate,
          payment.endDate
        );
      }
    }
    
    res.json({ 
      success: true, 
      message: payment.paymentType === 'installment' 
        ? `Installment ${installmentNumber} ${status}` 
        : `Payment ${status}`, 
      payment 
    });
  } catch (error) {
    console.error('Update Payment Status Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get payment stats
// @route   GET /api/payments/stats
// @access  Private/Admin
const getPaymentStats = async (req, res) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const revenue = await Payment.aggregate([
      { $match: { paymentStatus: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const installmentStats = await Payment.aggregate([
      { $match: { paymentType: 'installment' } },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalPayments,
        totalRevenue: revenue[0]?.total || 0,
        installmentStats
      }
    });
  } catch (error) {
    console.error('Payment Stats Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateServiceDates = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment || payment.paymentStatus !== 'approved') {
      return res.status(400).json({ success: false, message: 'Invalid payment' });
    }

    if (req.body.startDate) payment.startDate = new Date(req.body.startDate);
    if (req.body.endDate) payment.endDate = new Date(req.body.endDate);

    await payment.save();
    res.json({ success: true, payment });
  } catch (error) {
    console.error('Update Dates Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createPayment,
  choosePaymentType,
  payInstallment,
  getUserPayments,
  getPayment,
  getPaymentDetails,
  markServiceComplete,
  generatePaymentQR,
  updatePaymentStatus,
  getPaymentStats,
  updateServiceDates
};