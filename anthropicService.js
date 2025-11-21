export async function getReportSummary({ disease, age, reportText }) {
  // TODO: replace with real Anthropic API call later
  return {
    summary: `Example summary for ${disease}. (Dummy AI output for now.)`,
    advice:
      "Try to walk regularly, eat balanced meals, monitor your blood sugar, and consult your doctor regularly."
  };
}
