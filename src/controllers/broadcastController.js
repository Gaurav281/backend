// backend/src/controllers/broadcastController.js
const Broadcast = require('../models/Broadcast');

// @desc    Get all broadcast messages
// @route   GET /api/broadcast
// @access  Public
const getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.getActive();
    
    res.json({
      success: true,
      broadcasts
    });
  } catch (error) {
    console.error('Get Broadcasts Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get active broadcast message
// @route   GET /api/broadcast/active
// @access  Public
const getActiveBroadcast = async (req, res) => {
  try {
    const broadcasts = await Broadcast.getActive();
    
    // Get highest priority active message
    const activeMessage = broadcasts.length > 0 ? broadcasts[0] : null;
    
    res.json({
      success: true,
      message: activeMessage ? activeMessage.message : null
    });
  } catch (error) {
    console.error('Get Active Broadcast Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all broadcasts (Admin)
// @route   GET /api/admin/broadcast
// @access  Private/Admin
const getAllBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .populate('createdBy', 'name email')
      .sort('-createdAt');
    
    res.json({
      success: true,
      count: broadcasts.length,
      messages: broadcasts
    });
  } catch (error) {
    console.error('Get All Broadcasts Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create broadcast message
// @route   POST /api/admin/broadcast
// @access  Private/Admin
const createBroadcast = async (req, res) => {
  try {
    const { message, priority, isActive, expiresAt } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }
    
    const broadcast = await Broadcast.create({
      message,
      priority: priority || 'medium',
      isActive: isActive !== false, // Default to true
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      message: 'Broadcast created successfully',
      broadcast
    });
  } catch (error) {
    console.error('Create Broadcast Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update broadcast message
// @route   PUT /api/admin/broadcast/:id
// @access  Private/Admin
const updateBroadcast = async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }
    
    const { message, priority, isActive, expiresAt } = req.body;
    
    if (message) broadcast.message = message;
    if (priority) broadcast.priority = priority;
    if (typeof isActive !== 'undefined') broadcast.isActive = isActive;
    if (expiresAt) broadcast.expiresAt = new Date(expiresAt);
    
    await broadcast.save();
    
    res.json({
      success: true,
      message: 'Broadcast updated successfully',
      broadcast
    });
  } catch (error) {
    console.error('Update Broadcast Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete broadcast message
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

// @desc    Toggle broadcast status
// @route   PATCH /api/admin/broadcast/:id/status
// @access  Private/Admin
const toggleBroadcastStatus = async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }
    
    broadcast.isActive = !broadcast.isActive;
    await broadcast.save();
    
    res.json({
      success: true,
      message: `Broadcast ${broadcast.isActive ? 'activated' : 'deactivated'}`,
      broadcast
    });
  } catch (error) {
    console.error('Toggle Broadcast Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getBroadcasts,
  getActiveBroadcast,
  getAllBroadcasts,
  createBroadcast,
  updateBroadcast,
  deleteBroadcast,
  toggleBroadcastStatus
};