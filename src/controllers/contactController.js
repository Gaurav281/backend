const emailService = require('../utils/emailService');

// @desc    Send contact message
// @route   POST /api/contact
// @access  Public
const sendContactMessage = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and message are required'
      });
    }
    
    // Send email to admin
    const adminEmail = process.env.EMAIL_FROM;
    const emailHtml = `
      <h2>New Contact Message</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      <p><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `;
    
    const emailSent = await emailService.sendEmail(
      adminEmail,
      `Contact Form: ${subject || 'New Message'}`,
      emailHtml
    );
    
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send message'
      });
    }
    
    // Send confirmation email to user
    const userHtml = `
      <h2>Thank you for contacting us!</h2>
      <p>Hi ${name},</p>
      <p>We have received your message and will get back to you within 24 hours.</p>
      <p><strong>Your Message:</strong> ${message}</p>
      <p>Best regards,<br>The 5 Start Clips Team</p>
    `;
    
    await emailService.sendEmail(
      email,
      'Message Received - 5 Start Clips',
      userHtml
    );
    
    res.json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Send Contact Message Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  sendContactMessage
};