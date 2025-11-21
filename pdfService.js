// TEMPORARY DUMMY IMPLEMENTATION FOR HACKATHON
// We pretend to extract text from the PDF, but just return a fixed string.

export async function extractTextFromPdf(filePath) {
  // You can later replace this with real pdf-parse logic.
  const dummyText = `
    This is dummy extracted text from a PDF lab report.
    Fasting glucose is high, HbA1c is elevated, and the results are
    consistent with suboptimally controlled type 2 diabetes.
  `;
  return dummyText;
}
