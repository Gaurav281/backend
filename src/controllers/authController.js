//backend/src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const emailService = require('../utils/emailService');
const { validationResult } = require('express-validator');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register user & send OTP
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, password, socialMedia = [] } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      socialMedia: Array.isArray(socialMedia)
        ? socialMedia.filter(sm => sm.url && sm.url.trim() !== '')
        : []
    });

    // Generate OTP
    // const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    // const emailSent = await emailService.sendOTPEmail(email, name, otp);
    const emailSent = 1

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    res.status(201).json({
      success: true,
      message: 'OTP sent to your email',
      data: {
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Send OTP
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpiry');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new OTP
    const otp = user.generateOTP();
    console.log('Generated OTP:', otp);
    await user.save({ validateBeforeSave: false });

    // Send OTP email
    const emailSent = await emailService.sendOTPEmail(email, user.name, otp);
    // const emailSent = 1

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }

    res.json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpiry');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if OTP is valid
    if (!user.isValidOTP(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Verify user
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider || 'local',
        isVerified: user.isVerified,
        isActive: user.isActive !== false,
        isSuspicious: user.isSuspicious === true,
        installmentSettings: user.installmentSettings,
        socialMedia: Array.isArray(user.socialMedia)
          ? user.socialMedia.filter(sm => sm && sm.url && sm.url.trim() !== '')
          : []
      }
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider || 'local',
        isVerified: user.isVerified,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
// backend/src/controllers/authController.js
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -otp -otpExpiry');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Format exactly like profile endpoint
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      authProvider: user.authProvider || 'local',
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

    // console.log('Auth/me endpoint returning:', {
    //   id: userResponse._id,
    //   isSuspicious: userResponse.isSuspicious,
    //   installmentEnabled: userResponse.installmentSettings.enabled,
    //   socialMediaCount: userResponse.socialMedia.length
    // });

    res.json({
      success: true,
      user: userResponse,
      token: req.token // Include token if you want to refresh it
    });
  } catch (error) {
    console.error('Get Me Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate reset token
    const resetToken = generateToken(user._id);

    // Set reset token and expiry
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save({ validateBeforeSave: false });

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const emailSent = await emailService.sendEmail(email, 'Password Reset Request', `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 30 minutes.</p>
    `);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send reset email'
      });
    }

    res.json({
      success: true,
      message: 'Reset email sent'
    });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('+resetPasswordToken +resetPasswordExpire');

    if (!user || user.resetPasswordToken !== token || user.resetPasswordExpire < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset Password Error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid token'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  register,
  sendOTP,
  verifyOTP,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword
};