// frontend/app.js
const API_BASE = "http://localhost:4000"; 

document.addEventListener("DOMContentLoaded", () => {
  // 1. Select the Button, not just the form
  const analyzeBtn = document.getElementById("analyze-btn");
  
  const fileInput = document.getElementById("report-file");
  const ageInput = document.getElementById("age");
  const diseaseInput = document.getElementById("disease");
  const summaryP = document.getElementById("summary");
  const adviceP = document.getElementById("advice");
  const resultsSection = document.getElementById("results");

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

    // Show 'Loading...' state (Optional but helpful)
    analyzeBtn.textContent = "Analyzing...";
    analyzeBtn.disabled = true;

    const formData = new FormData();
    formData.append("report", fileInput.files[0]);
    formData.append("age", ageInput.value);
    formData.append("disease", diseaseInput.value);

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
});
