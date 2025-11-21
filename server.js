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

// Health check route
app.get("/", (req, res) => {
  res.send("Backend is running");
});

// Upload + analyze route
app.post(
  "/api/upload-report",
  requireAuth,
  upload.single("report"),
  async (req, res) => {
    try {
      const { age, disease } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).send("No file uploaded");
      }

      // 1) Extract text from PDF
      const reportText = await extractTextFromPdf(file.path);

      // 2) Save report in Supabase
      const { data: reportRow, error: reportErr } = await supabase
        .from("reports")
        .insert({
          disease,
          age: age ? parseInt(age, 10) : null,
          report_text: reportText,
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
      await supabase.from("ai_summaries").insert({
        report_id: reportRow?.id || null,
        summary: aiResult.summary,
        advice: aiResult.advice,
      });

      // 5) Send to frontend
      res.json({
        summary: aiResult.summary,
        advice: aiResult.advice,
      });

      // 6) Delete local file to tidy up
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
