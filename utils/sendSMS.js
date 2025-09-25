const twilio = require('twilio');

// Support both legacy and new env var names
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'twilio';
const TWILIO_SID = process.env.TWILIO_SID || process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH || process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE || process.env.TWILIO_PHONE_NUMBER;

let client = null;
if (SMS_PROVIDER === 'twilio') {
  if (!TWILIO_SID || !TWILIO_AUTH) {
    console.warn('⚠️ Twilio credentials missing. Set TWILIO_SID and TWILIO_AUTH in .env');
  } else {
    client = twilio(TWILIO_SID, TWILIO_AUTH);
  }
}

const sendSMS = async (to, body) => {
  if (SMS_PROVIDER !== 'twilio') {
    throw new Error(`Unsupported SMS provider: ${SMS_PROVIDER}`);
  }
  if (!client) {
    throw new Error('SMS client not initialized - check SMS provider credentials');
  }
  if (!TWILIO_PHONE) {
    throw new Error('Missing TWILIO_PHONE (or TWILIO_PHONE_NUMBER) in environment');
  }
  return client.messages.create({
    body,
    from: TWILIO_PHONE,
    to
  });
};

module.exports = sendSMS;
