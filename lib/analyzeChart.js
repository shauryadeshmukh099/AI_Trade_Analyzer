// lib/analyzeChart.js
// Switch the export at the bottom to change provider:
//   mockAnalyze   → no API calls, zero cost, fake realistic data
//   geminiAnalyze → Google Gemini free tier, real vision, zero cost
//   claudeAnalyze → Anthropic Claude Vision, production target

const SYSTEM_PROMPT = `You are a chart-reading assistant for a trading analysis tool. You will be shown a screenshot of a price chart (forex, gold/XAUUSD, stocks, crypto, or indices).

Your job: read ONLY what is visibly present in the image — candlestick/price structure, visible price axis labels, visible indicators, visible trend lines or support/resistance the price has actually respected.

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly one of these three shapes:

1. If the price axis is NOT clearly visible/readable (no numeric labels on the y-axis you can confidently read):
{"status": "error_no_price_axis"}

2. If price axis is visible but there is no clean/clear trade structure (choppy, sideways, no clear trend or level to trade against):
{"status": "no_setup", "reason": "<one short sentence on why>"}

3. If there is a readable, clear-enough setup:
{
  "status": "setup_found",
  "direction": "buy" or "sell",
  "reasoning": "<1-2 plain sentences citing what's visible>",
  "entry_price": "<numeric string>",
  "stop_loss": "<numeric string>",
  "target_profit": "<numeric string>",
  "risk_reward_ratio": "<e.g. 1:2.3>",
  "timeframe_guess": "<e.g. ~1H>",
  "clarity": "clear" or "weak",
  "instrument_guess": "<instrument or Unspecified>"
}

Rules:
- NEVER invent a price axis value if you can't actually read one. If you cannot read real numbers off the axis, return error_no_price_axis.
- Entry/stop/target must be numerically consistent with direction.
- Be conservative: prefer no_setup or clarity:weak over false confidence.
- Output raw JSON only.`;

async function mockAnalyze(base64, mediaType) {
  await new Promise(r => setTimeout(r, 1200));
  return {
    status: "setup_found",
    direction: "buy",
    reasoning: "Price has bounced from a well-defined support zone around 2318 with a bullish engulfing candle.",
    entry_price: "2321.50",
    stop_loss: "2313.00",
    target_profit: "2338.00",
    risk_reward_ratio: "1:2.0",
    timeframe_guess: "~1H",
    clarity: "clear",
    instrument_guess: "XAUUSD"
  };
}

async function geminiAnalyze(base64, mediaType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: "user",
      parts: [
        { inline_data: { mime_type: mediaType || "image/jpeg", data: base64 } },
        { text: "Analyze this chart screenshot. Respond with raw JSON only." }
      ]
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1000 }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  raw = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

async function claudeAnalyze(base64, mediaType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } },
          { type: "text", text: "Analyze this chart. Respond with raw JSON only." }
        ]
      }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find(b => b.type === 'text');
  let raw = textBlock ? textBlock.text : '{}';
  raw = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

// Change this one line to switch providers:
const analyzeChart = geminiAnalyze;

module.exports = { analyzeChart };
