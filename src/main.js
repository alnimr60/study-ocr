import './style.css';
import { OCREngine } from './processors/ocrEngine.js';
import { processPDF } from './processors/pdfProcessor.js';
import { processPPTX } from './processors/pptxProcessor.js';

const ocr = new OCREngine();

// UI Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const processingView = document.getElementById('processing-view');
const resultsView = document.getElementById('results-view');
const outputText = document.getElementById('output-text');
const processingStatus = document.getElementById('processing-status');
const progressBar = document.getElementById('progress-bar');
const pageIndicator = document.getElementById('page-indicator');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');

// Event Listeners
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(outputText.textContent);
  copyBtn.textContent = 'Copied!';
  setTimeout(() => copyBtn.textContent = 'Copy Text', 2000);
});

downloadBtn.addEventListener('click', () => {
  const blob = new Blob([outputText.textContent], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr-result-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

resetBtn.addEventListener('click', () => {
  resultsView.classList.add('hidden');
  dropZone.classList.remove('hidden');
  fileInput.value = '';
});

async function handleFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension !== 'pdf' && extension !== 'pptx') {
    alert('Please upload a PDF or PPTX file.');
    return;
  }

  // Show processing view
  dropZone.classList.add('hidden');
  processingView.classList.remove('hidden');
  
  try {
    let result = '';
    const onProgress = (data) => {
      if (data.status) processingStatus.textContent = data.status;
      if (data.page && data.totalPages) {
        pageIndicator.textContent = `Processing ${extension.toUpperCase()}: ${data.page} / ${data.totalPages}`;
        const overallProgress = (data.page - 1) / data.totalPages + (data.progress || 0) / data.totalPages;
        progressBar.style.width = `${overallProgress * 100}%`;
      }
    };

    if (extension === 'pdf') {
      result = await processPDF(file, ocr, onProgress);
    } else {
      result = await processPPTX(file, ocr, onProgress);
    }

    // Show results
    outputText.textContent = result;
    processingView.classList.add('hidden');
    resultsView.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Error processing file: ' + err.message);
    processingView.classList.add('hidden');
    dropZone.classList.remove('hidden');
  }
}
