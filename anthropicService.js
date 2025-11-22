const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-3-5-haiku-20241022";

export async function getReportSummary({ disease, age, reportText }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const payload = {
    model,
    max_tokens: 350,
    temperature: 0.2,
    system:
      "You are a medical report assistant. Provide concise, patient-friendly summaries and pragmatic advice. " +
      "Never give diagnoses; remind users to consult their clinician.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Summarize this medical report and provide 3-5 short advice items. " +
              "Return JSON with keys `summary` and `advice` (advice as a single string). " +
              `Disease: ${disease || "unknown"}; Age: ${age || "unknown"}; Report:\n${reportText}`,
          },
        ],
      },
    ],
  };

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const textContent =
    data?.content?.find((item) => item.type === "text")?.text ||
    data?.content?.[0]?.text ||
    "";

  try {
    const parsed = JSON.parse(textContent);
    return {
      summary: parsed.summary || "",
      advice: parsed.advice || "",
    };
  } catch (_err) {
    const fallback = textContent.trim() || "No response from model.";
    return {
      summary: fallback,
      advice:
        "Consult your healthcare provider for personalized advice based on the report.",
    };
  }
}

/**
 * Generates a concise trend summary using Anthropics based on HbA1c history and prior summaries.
 */
export async function getTrendSummary({
  disease,
  hba1cHistory = [],
  previousSummaries = [],
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const historyText = hba1cHistory
    .map(
      (row) =>
        `- ${row.reading_date || "unknown date"}: HbA1c ${row.value ?? "?"}%`
    )
    .join("\n");

  const summaryText = previousSummaries
    .map(
      (s) =>
        `- ${s.reports?.report_date || s.created_at || "unknown date"}: ${
          s.summary || "no summary"
        }`
    )
    .join("\n");

  const prompt = `
You are a concise medical trend assistant. Given HbA1c readings over time and the latest prior AI summaries, produce a short trend overview (2-3 sentences max).
- Keep tone patient-friendly, no diagnoses, emphasize discussing with clinician.
- Mention direction (rising/improving/stable), most recent value/date, and notable change over time.
- Do not repeat advice; focus on trend description only.
Return JSON: {"trendSummary": "<text>"}.

Disease: ${disease || "unknown"}
HbA1c history:
${historyText || "none"}

Recent summaries:
${summaryText || "none"}
`;

  const payload = {
    model,
    max_tokens: 250,
    temperature: 0.2,
    system:
      "You are a medical trend assistant. Keep responses short, cautious, and defer decisions to clinicians.",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ],
  };

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic trend request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const textContent =
    data?.content?.find((item) => item.type === "text")?.text ||
    data?.content?.[0]?.text ||
    "";

  try {
    const parsed = JSON.parse(textContent);
    return parsed.trendSummary || textContent || "";
  } catch (_err) {
    return textContent.trim() || "No trend summary.";
  }
}
