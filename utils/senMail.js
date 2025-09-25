const nodemailer = require('nodemailer');

// Respect only DISABLE_EMAIL flag
const isEmailDisabled = process.env.DISABLE_EMAIL === 'true';

let transporter = null;

async function getTransport() {
  if (isEmailDisabled) {
    return null;
  }

  // If custom SMTP is provided (e.g., Mailtrap), use it
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: false,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      console.log('✅ SMTP transporter initialized (custom SMTP)');
    }
    return transporter;
  }

  // Fallback for development: create Ethereal test account dynamically
  if (!transporter) {
    const test = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: test.user, pass: test.pass },
    });
    console.log('✅ Ethereal transporter initialized for development testing');
  }
  return transporter;
}

const sendMail = async (to, subject, html) => {
  try {
    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`📧 Subject: ${subject}`);
    console.log(`   - DISABLE_EMAIL: ${process.env.DISABLE_EMAIL}`);
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);

    if (isEmailDisabled) {
      console.log('⚠️ Email sending is disabled via DISABLE_EMAIL. Simulating send.');
      return { messageId: 'simulated', response: 'Email disabled', simulated: true };
    }

    const t = await getTransport();
    if (!t) {
      console.log('⚠️ No transport available; simulating send.');
      return { messageId: 'simulated', response: 'No transport', simulated: true };
    }

    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.EMAIL_USER || 'noreply@souq.dev';
    const info = await t.sendMail({ from, to, subject, html });
    console.log('✅ Email sent:', info.messageId);

    // If Ethereal, print preview URL
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) {
      console.log('🔗 Ethereal preview URL:', preview);
      // Attach preview to result for programmatic access
      info.previewUrl = preview;
    }

    return info;

  } catch (err) {
    console.error('❌ Email sending failed:', err);
    if (err.code === 'EAUTH') throw new Error('Email auth failed - check EMAIL_* vars');
    if (err.code === 'ECONNECTION') throw new Error('Email connection failed');
    if (err.code === 'EMESSAGE') throw new Error('Email message format error');
    throw new Error(`Email failed to send: ${err.message}`);
  }
};

// Function to force enable email for testing (recreate transport from env)
const forceEnableEmail = () => {
  try {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: false,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
    } else {
      // Fallback Ethereal
      // Note: cannot use async here, so just mark to rebuild on next send
      transporter = null;
    }
    console.log('✅ Email forcefully enabled (will rebuild transporter if needed)');
    return true;
  } catch (error) {
    console.error('❌ Failed to force enable email:', error.message);
    return false;
  }
};

// Function to test email configuration
const testEmailConfig = async () => {
  try {
    const t = await getTransport();
    if (!t) return false;
    const verified = await t.verify();
    console.log('✅ Email configuration verified:', verified);
    return verified;
  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    return false;
  }
};

// Export all functions as an object
module.exports = {
  sendMail,
  forceEnableEmail,
  testEmailConfig
};

// For backward compatibility, also export sendMail as default
module.exports.default = sendMail;