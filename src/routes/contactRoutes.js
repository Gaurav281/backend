const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const contactController = require('../controllers/contactController');

// Validation middleware
const contactValidation = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('email').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
  body('message').notEmpty().withMessage('Message is required').trim()
];

// Public route
router.post('/', contactValidation, contactController.sendContactMessage);

module.exports = router;