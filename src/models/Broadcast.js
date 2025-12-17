const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Default to 7 days from creation
      const date = new Date();
      date.setDate(date.getDate() + 7);
      return date;
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Check if broadcast is expired
broadcastSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Get active broadcasts
broadcastSchema.statics.getActive = function() {
  return this.find({ 
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ priority: -1, createdAt: -1 });
};

const Broadcast = mongoose.model('Broadcast', broadcastSchema);

module.exports = Broadcast;