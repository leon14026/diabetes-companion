// frontend/app.js
const API_BASE = "http://localhost:4000"; 

document.addEventListener("DOMContentLoaded", () => {
  // 1. Select the Button, not just the form
  const analyzeBtn = document.getElementById("analyze-btn");
  
  const fileInput = document.getElementById("report-file");
  const ageInput = document.getElementById("age");
  const diseaseInput = document.getElementById("disease");
  const reportDateInput = document.getElementById("report-date");

  const summaryP = document.getElementById("summary");
  const adviceP = document.getElementById("advice");
  const trendSummaryP = document.getElementById("trend-summary");
  const reportDateLabel = document.getElementById("report-date-label");
  const hba1cValueLabel = document.getElementById("hba1c-value");
  const hba1cEmptyState = document.getElementById("hba1c-empty");
  const hba1cChartCanvas = document.getElementById("hba1c-chart");
  const resultsSection = document.getElementById("results");

  let hba1cChart;

  // Check if button exists
  if (!analyzeBtn) {
    console.error("Button not found! Did you add id='analyze-btn' to the HTML?");
    return;
  }

  // 2. Change Event Listener to 'click' on the button
  analyzeBtn.addEventListener("click", async () => {
    console.log("Button clicked - preventing default handled by type='button'");

    // Basic Validation
    if (!fileInput.files[0]) {
      alert("Please upload a PDF file.");
      return;
    }
    if (!reportDateInput.value) {
      alert("Please select the date from the report.");
      return;
    }

    // Show 'Loading...' state (Optional but helpful)
    analyzeBtn.textContent = "Analyzing...";
    analyzeBtn.disabled = true;

    const formData = new FormData();
    formData.append("report", fileInput.files[0]);
    formData.append("age", ageInput.value);
    formData.append("disease", diseaseInput.value);
    formData.append("reportDate", reportDateInput.value);

    try {
      const res = await fetch(`${API_BASE}/api/upload-report`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error from server");
      }

      const data = await res.json();
      console.log("Data received:", data); // Debugging line

      summaryP.textContent = data.summary || "No summary returned.";
      adviceP.textContent = data.advice || "No advice returned.";
      trendSummaryP.textContent = data.trendSummary || "No trend yet.";
      reportDateLabel.textContent = data.reportDate || reportDateInput.value || "-";

      if (typeof data.hba1cValue === "number") {
        hba1cValueLabel.textContent = `${data.hba1cValue.toFixed(1)}%`;
      } else {
        hba1cValueLabel.textContent = "Not detected";
      }

      const history = Array.isArray(data.hba1cHistory) ? data.hba1cHistory : [];
      if (history.length) {
        hba1cEmptyState.style.display = "none";
        renderHbA1cChart(history);
      } else {
        hba1cEmptyState.style.display = "flex";
        if (hba1cChart) {
          hba1cChart.destroy();
          hba1cChart = null;
        }
      }

      resultsSection.style.display = "block";

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      // Reset button text
      analyzeBtn.textContent = "Upload & Analyze Report";
      analyzeBtn.disabled = false;
    }
  });

  function renderHbA1cChart(history = []) {
    if (!hba1cChartCanvas) return;

    const sorted = [...history].sort(
      (a, b) => new Date(a.reading_date) - new Date(b.reading_date)
    );

    const labels = sorted.map((item) =>
      new Date(item.reading_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    );
    const values = sorted.map((item) => item.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const suggestedMin = Number.isFinite(minVal) ? Math.max(4, minVal - 0.5) : 4;
    const suggestedMax = Number.isFinite(maxVal) ? maxVal + 0.5 : 10;

    if (hba1cChart) {
      hba1cChart.destroy();
    }

    hba1cChart = new Chart(hba1cChartCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "HbA1c (%)",
            data: values,
            tension: 0.3,
            fill: false,
            borderColor: "#2563eb",
            backgroundColor: "#2563eb",
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: { callback: (val) => `${val}%` },
            suggestedMin,
            suggestedMax,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `HbA1c: ${ctx.parsed.y}%`,
            },
          },
        },
      },
    });
  }
});
