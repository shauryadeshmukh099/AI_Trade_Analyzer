// api/analyze.js
// Vercel serverless function — POST /api/analyze
// Receives a chart image, runs AI analysis, returns structured trade setup JSON.
// The API key never touches the frontend.

import { analyzeChart } from '../lib/analyzeChart.js';

// Max image size: 5MB (Vercel free tier body limit is 4.5MB, keep headroom)
const MAX_SIZE_BYTES = 4 * 1024 * 1024;

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, mediaType } = req.body;

    // ── Validation ──────────────────────────────────────────
    if (!image) {
      return res.status(400).json({ error: 'Missing image field (base64 string expected)' });
    }

    if (typeof image !== 'string') {
      return res.status(400).json({ error: 'image must be a base64 string' });
    }

    // Rough size check on base64 string (base64 is ~33% larger than binary)
    const approxBytes = (image.length * 3) / 4;
    if (approxBytes > MAX_SIZE_BYTES) {
      return res.status(413).json({ error: 'Image too large. Maximum size is 4MB.' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const resolvedType = mediaType && allowedTypes.includes(mediaType)
      ? mediaType
      : 'image/jpeg'; // Default fallback

    // ── Analysis ────────────────────────────────────────────
    const result = await analyzeChart(image, resolvedType);

    // ── Validate result shape before sending ────────────────
    const validStatuses = ['setup_found', 'no_setup', 'error_no_price_axis'];
    if (!result?.status || !validStatuses.includes(result.status)) {
      console.error('Unexpected AI response shape:', result);
      return res.status(502).json({ error: 'Unexpected response from analysis model' });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Analysis error:', err.message);

    // Don't leak internal error details to the client
    return res.status(500).json({
      error: 'Analysis failed. Please try again.',
      // Only include detail in non-production for debugging
      ...(process.env.NODE_ENV !== 'production' && { detail: err.message })
    });
  }
}

// Vercel config — disable default body size limit since we handle it ourselves
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb'
    }
  }
};
