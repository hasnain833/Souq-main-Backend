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
    console.error('❌ Twilio client not initialized');
    console.error(`   TWILIO_SID: ${TWILIO_SID ? 'SET' : 'MISSING'}`);
    console.error(`   TWILIO_AUTH: ${TWILIO_AUTH ? 'SET' : 'MISSING'}`);
    throw new Error('SMS client not initialized - check SMS provider credentials');
  }
  if (!TWILIO_PHONE) {
    console.error('❌ TWILIO_PHONE_NUMBER not set in environment');
    throw new Error('Missing TWILIO_PHONE (or TWILIO_PHONE_NUMBER) in environment');
  }
  
  console.log(`📱 Attempting to send SMS to: ${to}`);
  console.log(`   From: ${TWILIO_PHONE}`);
  
  try {
    const message = await client.messages.create({
    body,
    from: TWILIO_PHONE,
    to
  });
    console.log(`✅ SMS sent successfully. SID: ${message.sid}`);
    return message;
  } catch (error) {
    console.error('❌ Twilio API error:', {
      code: error.code,
      status: error.status,
      message: error.message,
      moreInfo: error.moreInfo
    });
    // Preserve Twilio error codes for better error handling
    error.code = error.code;
    error.status = error.status;
    throw error;
  }
};

module.exports = sendSMS;
