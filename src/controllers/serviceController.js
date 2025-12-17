//backend/src/controllers/serviceController.js
const Service = require('../models/Service');
const Payment = require('../models/Payment');
const { validationResult } = require('express-validator');

// @desc    Get all services
// @route   GET /api/services
// @access  Public
const getServices = async (req, res) => {
  try {
    const { category, search, sort = '-createdAt' } = req.query;
    
    let query = { isActive: true };
    
    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }
    
    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const services = await Service.find(query)
      .sort(sort)
      .select('-__v');
    
    res.json({
      success: true,
      count: services.length,
      services
    });
  } catch (error) {
    console.error('Get Services Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single service
// @route   GET /api/services/:id
// @access  Public
const getService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    
    // Increment view count
    service.meta.views += 1;
    await service.save({ validateBeforeSave: false });
    
    res.json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Get Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get related services
// @route   GET /api/services/related/:id
// @access  Public
const getRelatedServices = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    
    const relatedServices = await Service.find({
      _id: { $ne: service._id },
      category: service.category,
      isActive: true
    })
    .limit(3)
    .select('name description price duration');
    
    res.json({
      success: true,
      services: relatedServices
    });
  } catch (error) {
    console.error('Get Related Services Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create service (Admin only)
// @route   POST /api/services
// @access  Private/Admin
const createService = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, description, category, features, price, duration, isPopular } = req.body;
    
    // Ensure features is an array
    const featuresArray = Array.isArray(features) ? features : [features];
    
    const service = await Service.create({
      name,
      description,
      category,
      features: featuresArray,
      price,
      duration,
      isPopular: isPopular || false,
      isActive: true
    });
    
    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service
    });
  } catch (error) {
    console.error('Create Service Error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Service with this name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update service (Admin only)
// @route   PUT /api/services/:id
// @access  Private/Admin
const updateService = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    let service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    
    const { name, description, category, features, price, duration, isActive, isPopular } = req.body;
    
    // Update fields
    if (name) service.name = name;
    if (description) service.description = description;
    if (category) service.category = category;
    if (features) service.features = Array.isArray(features) ? features : [features];
    if (price) service.price = price;
    if (duration) service.duration = duration;
    if (typeof isActive !== 'undefined') service.isActive = isActive;
    if (typeof isPopular !== 'undefined') service.isPopular = isPopular;
    
    await service.save();
    
    res.json({
      success: true,
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    console.error('Update Service Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete service (Admin only)
// @route   DELETE /api/services/:id
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
    
    // Check if service has active payments
    const activePayments = await Payment.countDocuments({
      serviceId: service._id,
      paymentStatus: 'approved',
      serviceStatus: { $in: ['active', 'pending'] }
    });
    
    if (activePayments > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete service with active subscriptions'
      });
    }
    
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

// @desc    Toggle service status (Admin only)
// @route   PATCH /api/services/:id/status
// @access  Private/Admin
const toggleServiceStatus = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }
    
    service.isActive = !service.isActive;
    await service.save();
    
    res.json({
      success: true,
      message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`,
      service
    });
  } catch (error) {
    console.error('Toggle Service Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get popular services
// @route   GET /api/services/popular
// @access  Public
const getPopularServices = async (req, res) => {
  try {
    const services = await Service.find({
      isPopular: true,
      isActive: true
    })
    .limit(6)
    .sort('-enrolledCount');
    
    res.json({
      success: true,
      services
    });
  } catch (error) {
    console.error('Get Popular Services Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get service statistics
// @route   GET /api/services/stats
// @access  Private/Admin
const getServiceStats = async (req, res) => {
  try {
    const totalServices = await Service.countDocuments();
    const activeServices = await Service.countDocuments({ isActive: true });
    const popularServices = await Service.countDocuments({ isPopular: true });
    
    // Get service with most enrollments
    const mostPopularService = await Service.findOne()
      .sort('-enrolledCount')
      .select('name enrolledCount');
    
    // Get category distribution
    const categoryStats = await Service.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalEnrolled: { $sum: '$enrolledCount' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalServices,
        activeServices,
        popularServices,
        mostPopularService,
        categoryStats
      }
    });
  } catch (error) {
    console.error('Get Service Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all services for admin (with all fields including inactive)
// @route   GET /api/admin/services
// @access  Private/Admin
const getAdminServices = async (req, res) => {
  try {
    const { search, category, sort = '-createdAt' } = req.query;
    
    let query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }
    
    const services = await Service.find(query)
      .sort(sort)
      .select('-__v');
    
    res.json({
      success: true,
      count: services.length,
      services
    });
  } catch (error) {
    console.error('Get Admin Services Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getServices,
  getService,
  getRelatedServices,
  createService,
  getAdminServices,
  updateService,
  deleteService,
  toggleServiceStatus,
  getPopularServices,
  getServiceStats
};