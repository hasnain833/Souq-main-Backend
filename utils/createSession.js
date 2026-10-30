const uaParser = require('ua-parser-js');
const axios = require('axios');
const Session = require('../db/models/sessionModel');

const createSession = async (req, userId, token) => {
  const userAgent = req.headers['user-agent'];
  let ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip;

  ip = ip.replace(/^::ffff:/, ''); // Normalize IPv6 localhost

  const parsedUA = uaParser(userAgent);
  const device = `${parsedUA.browser?.name || 'Unknown browser'}, ${parsedUA.os?.name || 'Unknown OS'}`;

  let location = 'Unknown';
  const localIps = ['127.0.0.1', '::1'];

  console.log('📍 IP Address:', ip);

  if (!localIps.includes(ip)) {
    try {
      const res = await axios.get(`https://ipapi.co/${ip}/json/`);
      const { city, country_name } = res.data;
      if (city && country_name) {
        location = `${city}, ${country_name}`;
      } else {
        console.warn('⚠️ Missing city or country in API response');
      }
    } catch (err) {
      console.error('❌ IP lookup failed:', err.message);
    }
  } else {
    console.log('ℹ️ Local IP detected, skipping geo lookup');
    location = 'Ahemdabad, India';
  }

  const session = new Session({
    userId,
    token,
    device,
    location,
    ip,
    isCurrent: true,
    lastActive: new Date(),
  });

  await session.save();
};

module.exports = createSession;
