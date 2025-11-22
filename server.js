import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";

import { supabase } from "./services/supabaseClient.js";
import { extractTextFromPdf } from "./services/pdfService.js";
import { getReportSummary } from "./services/anthropicService.js";
import { requireAuth } from "./middleware/authMiddleware.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());

// Multer: store uploaded files in "uploads/" folder
const upload = multer({ dest: "uploads/" });

/**
 * Pulls the first HbA1c value (percentage) it can find in the report text.
 * Returns null if none is detected so downstream logic can skip storage.
 */
function extractHbA1cValue(reportText = "") {
  const matches = [];
  const regex =
    /(?:hba1c|hb\s*a1c|a1c)\s*(?:level|value|reading)?\s*[:=]?\s*([\d]{1,2}(?:\.\d{1,2})?)/gi;

  let match;
  while ((match = regex.exec(reportText)) !== null) {
    const val = parseFloat(match[1]);
    if (!Number.isNaN(val) && val > 0 && val < 25) {
      matches.push(val);
    }
  }

  return matches.length ? matches[0] : null;
}

function buildHbA1cTrendSummary(history = [], previousSummaries = []) {
  if (!history.length) {
    return "No HbA1c history saved yet. Upload reports with dates to see trends.";
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.reading_date) - new Date(b.reading_date)
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const change = last.value - first.value;
  const direction =
    Math.abs(change) < 0.1
      ? "stable"
      : change > 0
        ? "rising"
        : "improving";

  const avg =
    sorted.reduce((sum, r) => sum + (r.value || 0), 0) /
    (sorted.length || 1);

  let summary = `Latest HbA1c ${last.value?.toFixed(1) ?? "n/a"}% on ${last.reading_date}. `;
  summary += `Trend looks ${direction} from ${first.value?.toFixed(1) ?? "n/a"}% to ${last.value?.toFixed(1) ?? "n/a"}%. `;
  summary += `Average across ${sorted.length} readings: ${avg.toFixed(1)}%.`;

  if (previousSummaries.length) {
    const mostRecent = previousSummaries[0];
    const lastSummaryDate =
      mostRecent?.reports?.report_date || mostRecent?.created_at;
    if (lastSummaryDate) {
      summary += ` Last summary recorded on ${lastSummaryDate}.`;
    }
  }

  return summary;
}

// Health check route
app.get("/", (req, res) => {
  res.send("Backend is running");
});

// Upload + analyze route
app.post("/api/upload-report", upload.single("report"), async (req, res) => {
    try {
      const { age, disease, reportDate } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).send("No file uploaded");
      }

      if (!reportDate) {
        return res.status(400).send("Report date is required");
      }

      const parsedReportDate = new Date(reportDate);
      if (Number.isNaN(parsedReportDate.getTime())) {
        return res.status(400).send("Report date is invalid");
      }

      // 1) Extract text from PDF
      const reportText = await extractTextFromPdf(file.path);
      const hba1cValue = extractHbA1cValue(reportText);

      // 2) Save report in Supabase
      const { data: reportRow, error: reportErr } = await supabase
        .from("reports")
        .insert({
          disease,
          age: age ? parseInt(age, 10) : null,
          report_text: reportText,
          report_date: reportDate,
        })
        .select()
        .single();

      if (reportErr) {
        console.error(reportErr);
      }

      // 3) Call AI (dummy for now)
      const aiResult = await getReportSummary({
        disease,
        age,
        reportText,
      });

      // 4) Save AI summary
      const { data: summaryRow } = await supabase
        .from("ai_summaries")
        .insert({
          report_id: reportRow?.id || null,
          summary: aiResult.summary,
          advice: aiResult.advice,
        })
        .select()
        .single();

      // 5) Save HbA1c reading (if present)
      if (hba1cValue !== null) {
        const { error: hbErr } = await supabase.from("hba1c_readings").insert({
          report_id: reportRow?.id || null,
          summary_id: summaryRow?.id || null,
          disease,
          reading_date: reportDate,
          value: hba1cValue,
        });

        if (hbErr) {
          console.error("Failed to save HbA1c reading", hbErr);
        }
      }

      // 6) Pull history for trend view
      const historyQuery = supabase
        .from("hba1c_readings")
        .select("reading_date,value")
        .order("reading_date", { ascending: true })
        .limit(50);

      if (disease) {
        historyQuery.eq("disease", disease);
      }

      const { data: hba1cHistory = [], error: historyErr } = await historyQuery;

      if (historyErr) {
        console.error("Could not fetch HbA1c history", historyErr);
      }

      const { data: previousSummaries = [], error: summariesErr } =
        await supabase
          .from("ai_summaries")
          .select("id, summary, created_at, report_id, reports!inner(report_date,disease)")
          .order("created_at", { ascending: false })
          .limit(5);

      if (summariesErr) {
        console.error("Could not fetch previous summaries", summariesErr);
      }

      const trendSummary = buildHbA1cTrendSummary(
        hba1cHistory || [],
        previousSummaries || []
      );

      // 7) Send to frontend
      res.json({
        summary: aiResult.summary,
        advice: aiResult.advice,
        reportDate,
        hba1cValue,
        hba1cHistory: hba1cHistory || [],
        trendSummary,
        previousSummaries: previousSummaries || [],
      });

      // 8) Delete local file to tidy up
      fs.unlink(file.path, () => {});
    } catch (err) {
      console.error(err);
      res.status(500).send("Server error");
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
