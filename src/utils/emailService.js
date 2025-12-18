const axios = require('axios');

class EmailService {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.senderEmail = process.env.EMAIL_FROM;
    this.senderName = process.env.APP_NAME || '5 Star Clips';

    this.client = axios.create({
      baseURL: 'https://api.brevo.com/v3',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  async sendEmail(to, subject, html) {
    try {
      const payload = {
        sender: {
          email: this.senderEmail,
          name: this.senderName
        },
        to: [{ email: to }],
        subject,
        htmlContent: html
      };

      await this.client.post('/smtp/email', payload);
      return true;
    } catch (error) {
      console.error(
        'Email sending failed (Brevo):',
        error.response?.data || error.message
      );
      return false;
    }
  }

  /* ================= PUBLIC METHODS ================= */

  async sendOTPEmail(email, name, otp) {
    const subject = `Verify Your Email – ${this.senderName}`;
    const html = this.generateOTPEmailTemplate(email, name, otp);
    return this.sendEmail(email, subject, html);
  }

  async sendPaymentStatusEmail(email, name, serviceName, status, transactionId) {
    const subject = `Payment ${status.toUpperCase()} – ${this.senderName}`;
    const html = this.generatePaymentStatusEmailTemplate(
      name,
      serviceName,
      status,
      transactionId
    );
    return this.sendEmail(email, subject, html);
  }

  async sendServiceEnrollmentEmail(email, name, serviceName, startDate, endDate) {
    const subject = `Service Enrolled – ${serviceName}`;
    const html = this.generateServiceEnrollmentEmailTemplate(
      name,
      serviceName,
      startDate,
      endDate
    );
    return this.sendEmail(email, subject, html);
  }

  /* ================= EMAIL LAYOUT ================= */

  baseTemplate(content) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f4f6f8;
            font-family: Arial, Helvetica, sans-serif;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
          }
          .header {
            background: linear-gradient(135deg, #6366f1, #7c3aed);
            padding: 24px;
            text-align: center;
            color: #ffffff;
          }
          .content {
            padding: 30px;
            color: #333333;
            line-height: 1.6;
          }
          .footer {
            background: #f1f5f9;
            text-align: center;
            padding: 16px;
            font-size: 12px;
            color: #6b7280;
          }
          .button {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #6366f1;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
          }
          .code-box {
            background: #f9fafb;
            border: 2px dashed #6366f1;
            padding: 16px;
            text-align: center;
            font-size: 28px;
            letter-spacing: 6px;
            font-weight: bold;
            color: #6366f1;
            margin: 20px 0;
            border-radius: 6px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${this.senderName}</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} ${this.senderName}. All rights reserved.<br/>
            This is an automated email. Please do not reply.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /* ================= TEMPLATES ================= */

  generateOTPEmailTemplate(email, name, otp) {
    return this.baseTemplate(`
      <h2>Hello ${name},</h2>
      <p>Thank you for signing up with <strong>${this.senderName}</strong>.</p>
      <p>Please use the following One-Time Password (OTP) to verify your email address:</p>

      <div class="code-box">${otp}</div>

      <p>This OTP is valid for <strong>10 minutes</strong>.</p>
      <p>If you did not request this verification, please ignore this email.</p>

      <p>Best regards,<br/>
      <strong>${this.senderName} Team</strong></p>
    `);
  }

  generatePaymentStatusEmailTemplate(name, serviceName, status, transactionId) {
    const statusColor =
      status === 'approved' ? '#16a34a' :
      status === 'rejected' ? '#dc2626' :
      '#f59e0b';

    return this.baseTemplate(`
      <h2>Hello ${name},</h2>
      <p>Your payment status for the service <strong>${serviceName}</strong> has been updated.</p>

      <p>
        <strong>Status:</strong>
        <span style="color:${statusColor}; font-weight:bold;">
          ${status.toUpperCase()}
        </span>
      </p>

      <p><strong>Transaction ID:</strong> ${transactionId}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>

      ${
        status === 'approved'
          ? `<p>Your service is now active and available in your dashboard.</p>`
          : ''
      }

      ${
        status === 'rejected'
          ? `<p>If you believe this is a mistake, please contact our support team.</p>`
          : ''
      }

      <p>Thank you for choosing <strong>${this.senderName}</strong>.</p>
    `);
  }

  generateServiceEnrollmentEmailTemplate(name, serviceName, startDate, endDate) {
    return this.baseTemplate(`
      <h2>Congratulations ${name} 🎉</h2>
      <p>You have been successfully enrolled in the following service:</p>

      <p><strong>Service:</strong> ${serviceName}</p>
      <p><strong>Start Date:</strong> ${new Date(startDate).toDateString()}</p>
      <p><strong>End Date:</strong> ${new Date(endDate).toDateString()}</p>
      <p><strong>Status:</strong> Active</p>

      <p>You can now access this service from your dashboard.</p>

      <p>If you need any help, feel free to contact our support team.</p>

      <p>Best wishes,<br/>
      <strong>${this.senderName} Team</strong></p>
    `);
  }
}

module.exports = new EmailService();
