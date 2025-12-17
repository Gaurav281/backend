//backend/src/models/Service.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    maxlength: [100, 'Service name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['saas', 'social', 'seo', 'web', 'marketing', 'other'],
    default: 'other'
  },
  features: [{
    type: String,
    required: true,
    trim: true
  }],
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  enrolledCount: {
    type: Number,
    default: 0
  },
  meta: {
    views: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for payments
serviceSchema.virtual('payments', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'serviceId',
  justOne: false
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;