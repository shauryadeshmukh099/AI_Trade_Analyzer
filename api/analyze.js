// api/analyze.js
const { analyzeChart } = require('../lib/analyzeChart');

const MAX_SIZE_BYTES = 4 * 1024 * 1024;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse body — handles both application/json and text/plain (to avoid CORS preflight)
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const { image, mediaType } = body;

    if (!image) {
      return res.status(400).json({ error: 'Missing image field' });
    }

    if (typeof image !== 'string') {
      return res.status(400).json({ error: 'image must be a base64 string' });
    }

    const approxBytes = (image.length * 3) / 4;
    if (approxBytes > MAX_SIZE_BYTES) {
      return res.status(413).json({ error: 'Image too large. Maximum size is 4MB.' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const resolvedType = mediaType && allowedTypes.includes(mediaType) ? mediaType : 'image/jpeg';

    const result = await analyzeChart(image, resolvedType);

    const validStatuses = ['setup_found', 'no_setup', 'error_no_price_axis'];
    if (!result?.status || !validStatuses.includes(result.status)) {
      return res.status(502).json({ error: 'Unexpected response from analysis model' });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Analysis error:', err.message);
    return res.status(500).json({
      error: 'Analysis failed. Please try again.',
      ...(process.env.NODE_ENV !== 'production' && { detail: err.message })
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb'
    }
  }
};
