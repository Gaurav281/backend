const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendEmail(to, subject, html) {
    try {
      const mailOptions = {
        from: `"${process.env.APP_NAME}" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);
      // console.log('Email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  async sendOTPEmail(email, name, otp) {
    const subject = 'Verify Your Email - 5 Start Clips';
    const html = await this.generateOTPEmailTemplate(email, name, otp);
    
    return await this.sendEmail(email, subject, html);
  }

  async sendPaymentStatusEmail(email, name, serviceName, status, transactionId) {
    const subject = `Payment ${status} - 5 Start Clips`;
    const html = await this.generatePaymentStatusEmailTemplate(name, serviceName, status, transactionId);
    
    return await this.sendEmail(email, subject, html);
  }

  async sendServiceEnrollmentEmail(email, name, serviceName, startDate, endDate) {
    const subject = `Service Enrolled - ${serviceName}`;
    const html = await this.generateServiceEnrollmentEmailTemplate(name, serviceName, startDate, endDate);
    
    return await this.sendEmail(email, subject, html);
  }

  async generateOTPEmailTemplate(email, name, otp) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-code { background: #fff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #667eea; border-radius: 5px; margin: 20px 0; border: 2px dashed #667eea; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>5 Start Clips</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Thank you for registering with 5 Start Clips. Please use the OTP below to verify your email address:</p>
            
            <div class="otp-code">${otp}</div>
            
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't create an account with us, please ignore this email.</p>
            
            <p>Best regards,<br>The 5 Start Clips Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} 5 Start Clips. All rights reserved.</p>
            <p>This email was sent to ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async generatePaymentStatusEmailTemplate(name, serviceName, status, transactionId) {
    const statusColors = {
      approved: '#10b981',
      rejected: '#ef4444',
      pending: '#f59e0b'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; margin: 10px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>5 Start Clips</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Your payment for <strong>${serviceName}</strong> has been <span class="status-badge" style="background: ${statusColors[status]};">${status.toUpperCase()}</span></p>
            
            <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Transaction ID:</strong> ${transactionId}</p>
              <p><strong>Service:</strong> ${serviceName}</p>
              <p><strong>Status:</strong> ${status}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            ${status === 'approved' ? '<p>Your service has been activated. You can now access it from your dashboard.</p>' : ''}
            ${status === 'rejected' ? '<p>Please contact support if you believe this is an error.</p>' : ''}
            
            <p>You can view the status of all your payments in your dashboard.</p>
            
            <p>Best regards,<br>The 5 Start Clips Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} 5 Start Clips. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async generateServiceEnrollmentEmailTemplate(name, serviceName, startDate, endDate) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .service-card { background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>5 Start Clips</h1>
          </div>
          <div class="content">
            <h2>Congratulations ${name}!</h2>
            <p>You have successfully enrolled in our service. Here are your service details:</p>
            
            <div class="service-card">
              <h3>${serviceName}</h3>
              <p><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString()}</p>
              <p><strong>End Date:</strong> ${new Date(endDate).toLocaleDateString()}</p>
              <p><strong>Status:</strong> Active</p>
            </div>
            
            <p>You can now access your service from the dashboard. Our support team is available 24/7 to assist you.</p>
            
            <p>Thank you for choosing 5 Start Clips!</p>
            
            <p>Best regards,<br>The 5 Start Clips Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} 5 Start Clips. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();