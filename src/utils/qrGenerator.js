const QRCode = require('qrcode');

class QRGenerator {
  static async generatePaymentQR(upiId, amount, name, description = 'Service Payment') {
    try {
      const upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(description)}`;
      
      const qrCode = await QRCode.toDataURL(upiString, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      return qrCode;
    } catch (error) {
      console.error('QR Generation Error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  static async generateBase64QR(data) {
    try {
      const qrCode = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        width: 200
      });
      
      return qrCode;
    } catch (error) {
      console.error('Base64 QR Generation Error:', error);
      return null;
    }
  }
}

module.exports = QRGenerator;