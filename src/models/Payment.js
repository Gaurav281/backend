const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema({
  installmentNumber: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },

  // NEW FIELDS (from DeepSeek)
  paidDate: Date,
  status: {
    type: String,
    enum: [
      'pending',
      'submitted',
      'approved',
      'paid',
      'rejected',
      'overdue',
      'cancelled'
    ],
    default: 'pending'
  },
  transactionId: String,
  submittedAt: Date,
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
});

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },

  // Payment type
  paymentType: {
    type: String,
    enum: ['full', 'installment'],
    default: 'full'
  },

  // Installments
  installments: [installmentSchema],

  // Amount tracking
  amountPaid: {
    type: Number,
    default: 0
  },
  amountDue: {
    type: Number,
    default: 0
  },

  // Payment status
  paymentStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'partial'],
    default: 'pending'
  },

  serviceStatus: {
    type: String,
    enum: ['pending', 'active', 'completed', 'expired', 'suspended'],
    default: 'pending'
  },

  // Service dates
  startDate: Date,
  endDate: Date,

  // Notes
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  adminNotes: {
    type: String,
    trim: true,
    maxlength: 500
  },

  paymentMethod: {
    type: String,
    default: 'upi'
  },

  metadata: {
    upiId: String,
    qrCode: String,
    screenshot: String
  },

  // Flags
  isServiceCompleted: {
    type: Boolean,
    default: false
  },
  markedSuspicious: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});


// ==========================
// PRE-SAVE LOGIC
// ==========================
paymentSchema.pre('save', function () {
  if (this.paymentType === 'installment' && this.installments.length > 0) {
    const totalAmount = this.installments.reduce(
      (sum, inst) => sum + inst.amount, 0
    );

    const paidInstallments = this.installments.filter(
      inst => inst.status === 'paid'
    );

    const paidAmount = paidInstallments.reduce(
      (sum, inst) => sum + inst.amount, 0
    );

    this.amountPaid = paidAmount;
    this.amountDue = totalAmount - paidAmount;

    if (paidAmount === 0) {
      this.paymentStatus = 'pending';
    } else if (paidAmount === totalAmount) {
      this.paymentStatus = 'approved';
    } else {
      this.paymentStatus = 'partial';
    }
  } else {
    this.amountPaid = this.paymentStatus === 'approved' ? this.amount : 0;
    this.amountDue = this.amount - this.amountPaid;
  }

  if (this.isServiceCompleted) {
    this.serviceStatus = 'completed';
  }
});


// ==========================
// STATIC: USER SUSPICION
// ==========================
paymentSchema.statics.updateUserSuspicion = async function (userId, isSuspicious) {
  const User = require('./User');
  await User.findByIdAndUpdate(userId, {
    isSuspicious,
    $set: {
      'installmentSettings.enabled': !isSuspicious
    }
  });
};


// ==========================
// METHODS
// ==========================
paymentSchema.methods.checkOverdueInstallments = function () {
  if (this.paymentType !== 'installment') return false;

  const now = new Date();
  return this.installments.some(
    inst => inst.status === 'pending' && inst.dueDate < now
  );
};

paymentSchema.methods.submitInstallment = function (installmentNumber, transactionId) {
  const installment = this.installments.find(
    inst => inst.installmentNumber === installmentNumber
  );

  if (!installment) throw new Error('Installment not found');

  installment.status = 'submitted';
  installment.transactionId = transactionId;
  installment.submittedAt = new Date();
};

paymentSchema.methods.approveInstallment = function (installmentNumber, adminId) {
  const installment = this.installments.find(
    inst => inst.installmentNumber === installmentNumber
  );

  if (!installment) throw new Error('Installment not found');

  installment.status = 'paid';
  installment.paidDate = new Date();
  installment.approvedAt = new Date();
  installment.approvedBy = adminId;
};


// ==========================
// VIRTUALS
// ==========================
paymentSchema.virtual('daysRemaining').get(function () {
  if (!this.endDate || this.serviceStatus !== 'active') return 0;

  const diff = new Date(this.endDate) - new Date();
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
});

paymentSchema.virtual('nextDueDate').get(function () {
  if (this.paymentType !== 'installment') return null;

  const pending = this.installments
    .filter(inst => inst.status === 'pending')
    .sort((a, b) => a.dueDate - b.dueDate);

  return pending.length ? pending[0].dueDate : null;
});

module.exports = mongoose.model('Payment', paymentSchema);
