# Diabetes Companion – API & Component Reference

This project provides a simple end‑to‑end workflow for uploading a lab report PDF, extracting its text, storing it in Supabase, and returning an AI-generated summary plus actionable advice to a web client.

Use this document as the single source of truth for all publicly exposed HTTP APIs, server utilities, and frontend components.

---

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create a `.env` file** (same directory as `package.json`) and set:
   ```
   PORT=4000                # optional, defaults to 4000
   FRONTEND_ORIGIN=http://localhost:3000  # or wherever the client runs
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_KEY=<service-role-or-anon-key>
   ```
   > `anthropicService.js` currently returns mock data, so no AI key is required yet.
3. **Run the server**
   ```bash
   npm start
   ```
4. **Open the static client** (for quick local testing) by serving `index.html` with any static file server or by opening it directly in a browser and pointing `API_BASE` inside `app.js` to your backend origin.

---

## Application Flow Overview

1. `index.html` renders a minimal upload form and result section.
2. `app.js` intercepts form submission, builds a `FormData` payload, and sends `POST /api/upload-report`.
3. `server.js` receives the multipart request, runs middleware, and orchestrates:
   - temporary file storage via Multer
   - PDF text extraction (`extractTextFromPdf`)
   - persistence to Supabase (`supabase` client)
   - report summarization (`getReportSummary`)
4. The server responds with JSON `{ summary, advice }`, which the frontend renders.

---

## HTTP API Reference

All endpoints live under `server.js`. The server uses Express 5 with JSON parsing and CORS configured to trust `FRONTEND_ORIGIN`.

### `GET /`
- **Description:** Health-check endpoint.
- **Auth:** None.
- **Response:** Plain text `"Backend is running"`.
- **Example:**
  ```bash
  curl http://localhost:4000/
  ```

### `POST /api/upload-report`
- **Description:** Uploads a lab report PDF, persists its contents, and returns an AI-generated summary plus advice.
- **Auth:** `requireAuth` middleware (currently a no-op placeholder that always allows).
- **Headers:** `Content-Type: multipart/form-data` (handled automatically by browsers when using `FormData`).
- **Body fields (multipart):**
  - `report` (required) – PDF file.
  - `age` (optional) – integer; coerced server-side.
  - `disease` (required) – string (e.g., `"diabetes"`).
- **Success response:** `200 OK`
  ```json
  {
    "summary": "Example summary for diabetes. (Dummy AI output for now.)",
    "advice": "Try to walk regularly, eat balanced meals, monitor your blood sugar, and consult your doctor regularly."
  }
  ```
- **Failure cases:**
  - `400` – missing file upload (`"No file uploaded"`).
  - `500` – unexpected server error (check logs).
- **Example (cURL):**
  ```bash
  curl -X POST http://localhost:4000/api/upload-report \
       -F "report=@/path/to/report.pdf" \
       -F "age=55" \
       -F "disease=diabetes"
  ```
- **Processing steps:**
  1. Multer stores the PDF temporarily in `uploads/`.
  2. `extractTextFromPdf(file.path)` converts the PDF to raw text (currently mocked).
  3. A `reports` row is inserted into Supabase with `disease`, `age`, and `report_text`.
  4. `getReportSummary({ disease, age, reportText })` returns `summary` and `advice`.
  5. `ai_summaries` receives a record linking back to the saved report.
  6. The temp file is deleted via `fs.unlink`.

---

## Server-Side Modules & Functions

### `server.js`
Key exports: none (runs the HTTP server). Notable public behavior is the two routes described above.

### `authMiddleware.js`
```js
export function requireAuth(req, res, next) {
  next();
}
```
- Intercepts protected routes.
- Currently a placeholder that simply calls `next()`.
- **Usage:** Attach to any Express route to reserve a hook for future authentication logic.

### `pdfService.js`
```js
export async function extractTextFromPdf(filePath) { ... }
```
- **Inputs:** `filePath` pointing to the PDF saved by Multer.
- **Outputs:** Resolves a string containing the extracted text (currently a hard-coded sample).
- **Usage example:**
  ```js
  const text = await extractTextFromPdf("/tmp/report.pdf");
  console.log(text);
  ```
- **Future extension:** Replace the dummy implementation with `pdf-parse` or another PDF processing library.

### `anthropicService.js`
```js
export async function getReportSummary({ disease, age, reportText }) { ... }
```
- **Inputs:** Object with the disease context, patient age, and extracted report text.
- **Outputs:** `{ summary: string, advice: string }`.
- **Current behavior:** Returns deterministic placeholder content tailored to the passed `disease`.
- **Usage example:**
  ```js
  const result = await getReportSummary({
    disease: "diabetes",
    age: 55,
    reportText: "Fasting glucose is high...",
  });
  // -> { summary: "...", advice: "..." }
  ```
- **Extension point:** Swap the internals for a real Anthropic (or other LLM) API call once credentials are available.

### `supabaseClient.js`
```js
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
```
- Creates a singleton Supabase client configured via environment variables.
- **Usage:** Import `supabase` in any service or route to perform database operations.
- **Example query:**
  ```js
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .limit(10);
  ```

---

## Frontend Components

### `index.html`
- Presents the "Diabetes Companion" form with fields for `disease`, `age`, and PDF upload.
- Includes a hidden `#results` section that becomes visible once data is returned.
- Loads `app.js` via `<script src="app.js"></script>`.

### `app.js`
Core logic:
```js
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append("report", fileInput.files[0]);
  formData.append("age", ageInput.value);
  formData.append("disease", diseaseInput.value);
  const res = await fetch(`${API_BASE}/api/upload-report`, { method: "POST", body: formData });
  const data = await res.json();
  summaryP.textContent = data.summary;
  adviceP.textContent = data.advice;
  resultsSection.style.display = "block";
});
```
- `API_BASE` defaults to `http://localhost:4000`; change it when deploying the backend elsewhere.
- Handles validation (ensuring a PDF is provided) and basic error reporting via `alert`.
- Updates the DOM with the AI output upon success.

---

## Manual Usage Examples

### End-to-End Browser Flow
1. Start the backend with `npm start`.
2. Open `index.html` in a browser (or deploy it behind a static server).
3. Choose a disease preset, optionally enter an age, and upload any PDF file.
4. Submit the form; the summary and advice appear in the `Results` section once the request completes.

### Programmatic Upload (Node.js)
```js
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

const form = new FormData();
form.append("report", fs.createReadStream("./fixtures/report.pdf"));
form.append("age", "48");
form.append("disease", "diabetes");

const res = await fetch("http://localhost:4000/api/upload-report", {
  method: "POST",
  body: form,
});
const data = await res.json();
console.log(data.summary, data.advice);
```

---

## Extensibility Notes
- **Authentication:** Replace the body of `requireAuth` with real checks (JWT, session, etc.) to gate `POST /api/upload-report`.
- **PDF parsing:** Integrate `pdf-parse` (already in dependencies) inside `extractTextFromPdf`.
- **AI Integration:** Connect `getReportSummary` to Anthropic, OpenAI, or another provider. Handle API keys via environment variables.
- **Data model:** Ensure `reports` and `ai_summaries` tables exist in Supabase with the columns referenced in `server.js`.

This documentation should be updated whenever new routes, services, or client interactions are introduced so the API surface stays discoverable.