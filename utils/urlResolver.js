const resolveS3Url = (key) => {
  if (!key) {
    console.warn('resolveS3Url: No key provided');
    return null;
  }
  
  // Return original URL if already absolute (starts with http/https)
  if (/^https?:\/\//i.test(key)) {
    return key;
  }
  
  // Get AWS URL from environment variables
  const awsUrl = process.env.AWS_URL;
  if (!awsUrl) {
    console.error('resolveS3Url: AWS_URL environment variable not set');
    console.error('Available env vars:', {
      AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
      AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
      AWS_BUCKET: process.env.AWS_BUCKET,
      AWS_URL: process.env.AWS_URL
    });
    return key; // Return original key as fallback
  }
  
  // Ensure AWS_URL ends with a slash
  const baseUrl = awsUrl.endsWith('/') ? awsUrl : `${awsUrl}/`;
  
  // Remove leading slash from key if present
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  
  // Return absolute URL
  const resolvedUrl = `${baseUrl}${cleanKey}`;
  return resolvedUrl;
};

const resolveS3Urls = (keys) => {
  if (!Array.isArray(keys)) {
    console.warn('resolveS3Urls: Not an array:', keys);
    return [];
  }
  return keys.map(key => resolveS3Url(key)).filter(Boolean);
};

const extractS3Key = (url) => {
  if (!url) return null;
  
  // If it's already a relative path, return as is
  if (!/^https?:\/\//i.test(url)) {
    return url;
  }
  
  // Extract key from absolute URL
  const awsUrl = process.env.AWS_URL;
  if (awsUrl && url.startsWith(awsUrl)) {
    return url.replace(awsUrl, '').replace(/^\//, '');
  }
  
  return url;
};

const isValidS3Url = (url) => {
  if (!url) return false;
  
  // Check if it's a valid URL format
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:' && urlObj.hostname.includes('s3');
  } catch {
    return false;
  }
};

module.exports = {
  resolveS3Url,
  resolveS3Urls,
  extractS3Key,
  isValidS3Url
};
