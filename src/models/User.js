//backend/src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSuspicious: {
    type: Boolean,
    default: false
  },
  // Installment settings (admin controlled)
  installmentSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    splits: [{
      percentage: {
        type: Number,
        min: 1,
        max: 100,
        default: 30
      },
      dueDays: {
        type: Number,
        default: 0 // 0 means due immediately
      }
    }],
    defaultSplits: {
      type: [Number],
      default: [30, 70]
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date
    }
  },
  // Social media links
  socialMedia: [{
    platform: {
      type: String,
      enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'other'],
      required: true
    },
    url: {
      type: String,
      required: true,
      match: [
        /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
        'Please add a valid URL'
      ]
    }
  }],
  otp: {
    type: String,
    select: false
  },
  otpExpiry: {
    type: Date,
    select: false
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  enrolledServices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  }],
  lastLogin: Date
}, {
  timestamps: true
});

// Encrypt password before saving
userSchema.pre('save', async function () {
  if (!this.password) return;

  if (!this.isModified('password')) return;

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    console.error('Error hashing password:', error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate OTP
userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  this.otp = otp;
  this.otpExpiry = otpExpiry;

  return otp;
};

// Check if OTP is valid
userSchema.methods.isValidOTP = function (otp) {
  return this.otp === otp && this.otpExpiry > new Date();
};

// Check if installment is enabled for user
userSchema.methods.canUseInstallment = function () {
  return this.installmentSettings.enabled === true;
};

const User = mongoose.model('User', userSchema);

module.exports = User;