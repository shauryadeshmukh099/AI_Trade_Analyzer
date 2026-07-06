// lib/analyzeChart.js
// ─────────────────────────────────────────────────────────────
// Single function that the /api/analyze endpoint calls.
// Switch the export at the bottom to change provider:
//   mockAnalyze   → no API calls, zero cost, fake realistic data
//   geminiAnalyze → Google Gemini free tier, real vision, zero cost
//   claudeAnalyze → Anthropic Claude Vision, production target (~$0.01/call)
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a chart-reading assistant for a trading analysis tool. You will be shown a screenshot of a price chart (forex, gold/XAUUSD, stocks, crypto, or indices).

Your job: read ONLY what is visibly present in the image — candlestick/price structure, visible price axis labels, visible indicators, visible trend lines or support/resistance the price has actually respected.

Respond ONLY with raw JSON, no markdown fences, no preamble, matching exactly one of these three shapes:

1. If the price axis is NOT clearly visible/readable (no numeric labels on the y-axis you can confidently read):
{"status": "error_no_price_axis"}

2. If price axis is visible but there is no clean/clear trade structure (choppy, sideways, no clear trend or level to trade against):
{"status": "no_setup", "reason": "<one short sentence on why, e.g. price is consolidating in a tight range with no clear breakout>"}

3. If there is a readable, clear-enough setup:
{
  "status": "setup_found",
  "direction": "buy" or "sell",
  "reasoning": "<1-2 plain sentences citing what's visible: trend, structure, candle pattern, support/resistance, indicator if visible>",
  "entry_price": "<numeric string as it would appear on this chart's axis, e.g. 2387.40>",
  "stop_loss": "<numeric string>",
  "target_profit": "<numeric string>",
  "risk_reward_ratio": "<e.g. 1:2.3>",
  "timeframe_guess": "<your best guess of chart timeframe from candle spacing/density, e.g. '1H' or '4H' or 'Daily' — prefix with ~ since this is inferred>",
  "clarity": "clear" or "weak",
  "instrument_guess": "<your best guess of the instrument/pair visible on chart, or 'Unspecified' if not legible>"
}

Rules:
- NEVER invent a price axis value if you can't actually read one. If you cannot read real numbers off the axis, you MUST return error_no_price_axis.
- Entry/stop/target must be numerically consistent with the direction (for buy: stop < entry < target; for sell: target < entry < stop).
- Be conservative: if the chart is ambiguous, prefer "no_setup" or "clarity": "weak" over fabricating false confidence.
- Do not mention candlestick colors as if you're certain unless clearly visible.
- Output raw JSON only.`;

// ─── 1. MOCK (zero cost, no API) ──────────────────────────────
async function mockAnalyze(base64, mediaType) {
  // Simulates realistic latency
  await new Promise(r => setTimeout(r, 1200));

  // Returns a hardcoded but realistic response matching the real JSON shape.
  // Rotate through all three states during dev to test all UI paths.
  const mockResponses = [
    {
      status: "setup_found",
      direction: "buy",
      reasoning: "Price has bounced from a well-defined support zone around 2318 with a bullish engulfing candle. Structure shows higher lows forming on the visible portion of the chart.",
      entry_price: "2321.50",
      stop_loss: "2313.00",
      target_profit: "2338.00",
      risk_reward_ratio: "1:2.0",
      timeframe_guess: "~1H",
      clarity: "clear",
      instrument_guess: "XAUUSD"
    },
    {
      status: "no_setup",
      reason: "Price is consolidating in a tight range between 2310 and 2325 with no clear breakout direction or trend structure."
    },
    {
      status: "error_no_price_axis"
    }
  ];

  // Cycle through them: change index manually to test different states
  return mockResponses[0];
}

// ─── 2. GEMINI (free tier, real vision) ───────────────────────
async function geminiAnalyze(base64, mediaType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment variables');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inline_data: {
              mime_type: mediaType || "image/jpeg",
              data: base64
            }
          },
          {
            text: "Analyze this chart screenshot per your instructions. Respond with raw JSON only."
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,        // Low temp = more consistent, less hallucination
      maxOutputTokens: 1000
    }
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

// ─── 3. CLAUDE (production target) ────────────────────────────
async function claudeAnalyze(base64, mediaType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in environment variables');

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
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } },
            { type: "text", text: "Analyze this chart screenshot per your instructions. Respond with raw JSON only." }
          ]
        }
      ]
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

// ─── ACTIVE PROVIDER ──────────────────────────────────────────
// Change this one line to switch providers:
//   mockAnalyze   → dev, zero cost
//   geminiAnalyze → dev, real vision, free tier
//   claudeAnalyze → production
export const analyzeChart = geminiAnalyze;
