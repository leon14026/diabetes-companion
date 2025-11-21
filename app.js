const API_BASE = "http://localhost:4000"; // change later when deployed

const form = document.getElementById("report-form");
const summaryP = document.getElementById("summary");
const adviceP = document.getElementById("advice");
const resultsSection = document.getElementById("results");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById("report-file");
  const ageInput = document.getElementById("age");
  const diseaseInput = document.getElementById("disease");

  if (!fileInput.files[0]) {
    alert("Please upload a PDF file.");
    return;
  }

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
    summaryP.textContent = data.summary;
    adviceP.textContent = data.advice;
    resultsSection.style.display = "block";
  } catch (err) {
    console.error(err);
    alert("There was an error. Check the console for details.");
  }
});
