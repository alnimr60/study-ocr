// --- CONFIGURATION & GLOBALS ---
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
} catch(e) {}

// --- STATE ---
let ocrWorker = null;
let isEngineReady = false;

// --- UI ELEMENTS ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const processingView = document.getElementById('processing-view');
const resultsView = document.getElementById('results-view');
const outputText = document.getElementById('output-text');
const processingStatus = document.getElementById('processing-status');
const progressBar = document.getElementById('progress-bar');
const pageIndicator = document.getElementById('page-indicator');
const debugLog = document.getElementById('debug-log');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');

// --- UTILS ---
function log(msg) {
    console.log(msg);
    const entry = document.createElement('div');
    entry.className = 'debug-entry';
    entry.textContent = `> ${msg}`;
    debugLog.prepend(entry);
}

// --- OCR ENGINE ---
async function initOCR(onStatus) {
    if (isEngineReady) return;
    onStatus('Initializing OCR Engine...');
    try {
        // In Tesseract v5, logger is part of createWorker options
        ocrWorker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract' || m.status === 'loading language traineddata') {
                    onStatus(`${m.status} (${Math.round(m.progress * 100)}%)...`);
                }
            },
            errorHandler: e => log(`WORKER ERROR: ${e}`)
        });
        isEngineReady = true;
        onStatus('OCR Engine Ready!');
    } catch (err) {
        log(`OCR INIT ERROR: ${err.message}`);
        throw err;
    }
}

async function doOCR(imageSource, onProgress, onStatus) {
    if (!isEngineReady) await initOCR(onStatus);
    log('Starting OCR recognition...');
    
    // Heartbeat timer to show life
    const heartbeat = setInterval(() => log('OCR Engine is working...'), 3000);
    
    try {
        // In v5, recognize only takes image and options
        const { data: { text } } = await ocrWorker.recognize(imageSource);
        clearInterval(heartbeat);
        log('OCR Recognition finished successfully!');
        return text;
    } catch (err) {
        clearInterval(heartbeat);
        log(`RECOGNIZE ERROR: ${err.message}`);
        throw err;
    }
}

// --- PDF PROCESSOR ---
async function processPDF(file, onProgress) {
    log('Reading PDF...');
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        disableAutoFetch: true,
        disableStream: true
    });
    
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    log(`PDF Opened. Pages: ${totalPages}`);
    
    let fullText = '';
    for (let i = 1; i <= totalPages; i++) {
        onProgress({ page: i, totalPages, status: `Rendering page ${i}...` });
        const page = await pdf.getPage(i);
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const scale = isMobile ? 1.2 : 2.0;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport }).promise;
        
        onProgress({ page: i, totalPages, status: `OCRing page ${i}...` });
        const text = await doOCR(canvas, (p) => {
            onProgress({ page: i, totalPages, progress: p, status: `OCRing page ${i} (${Math.round(p * 100)}%)...` });
        }, (s) => onProgress({ status: s }));
        
        fullText += `## Page ${i}\n\n${text}\n\n---\n\n`;
    }
    return fullText;
}

// --- PPTX PROCESSOR ---
async function processPPTX(file, onProgress) {
    log('Reading PPTX...');
    const zip = await JSZip.loadAsync(file);
    const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
    const totalSlides = slideFiles.length;
    log(`PPTX Opened. Slides: ${totalSlides}`);

    let fullText = '';
    for (let i = 1; i <= totalSlides; i++) {
        onProgress({ page: i, totalPages: totalSlides, status: `Processing slide ${i}...` });
        const slideXml = await zip.file(`ppt/slides/slide${i}.xml`).async('string');
        const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
        fullText += `## Slide ${i}\n\n${textMatches.map(m => m.replace(/<a:t>|<\/a:t>/g, '')).join(' ')}\n\n`;
    }
    
    // Media
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
    for (let j = 0; j < mediaFiles.length; j++) {
        onProgress({ status: `OCRing Media ${j+1}/${mediaFiles.length}...` });
        const imgBlob = await zip.file(mediaFiles[j]).async('blob');
        const imgUrl = URL.createObjectURL(imgBlob);
        const text = await doOCR(imgUrl, null, (s) => onProgress({ status: s }));
        if (text.trim()) fullText += `### Image Media ${j+1}\n\n${text}\n\n`;
        URL.revokeObjectURL(imgUrl);
    }
    return fullText;
}

// --- MAIN HANDLER ---
async function handleFile(file) {
    log(`Selected: ${file.name} (${(file.size/1024/1024).toFixed(2)}MB)`);
    const ext = file.name.split('.').pop().toLowerCase();
    
    dropZone.classList.add('hidden');
    processingView.classList.remove('hidden');
    
    try {
        const onProgress = (data) => {
            if (data.status) {
                processingStatus.textContent = data.status;
                log(data.status);
            }
            if (data.page && data.totalPages) {
                pageIndicator.textContent = `Progress: ${data.page}/${data.totalPages}`;
                const p = ((data.page - 1) / data.totalPages) + ((data.progress || 0) / data.totalPages);
                progressBar.style.width = `${p * 100}%`;
            }
        };

        let result = '';
        if (ext === 'pdf') {
            result = await processPDF(file, onProgress);
        } else if (ext === 'pptx') {
            result = await processPPTX(file, onProgress);
        } else if (['jpg', 'jpeg', 'png'].includes(ext)) {
            const url = URL.createObjectURL(file);
            result = await doOCR(url, (p) => onProgress({ status: `OCRing Image (${Math.round(p*100)}%)` }), (s) => onProgress({ status: s }));
            URL.revokeObjectURL(url);
        } else {
            throw new Error(`Unsupported format: .${ext}`);
        }

        outputText.textContent = result || "OCR finished, but no text found.";
        processingView.classList.add('hidden');
        resultsView.classList.remove('hidden');
    } catch (err) {
        log(`CRITICAL ERROR: ${err.message}`);
        alert(`Error: ${err.message}`);
        processingView.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }
}

// --- EVENTS ---
dropZone.onclick = () => fileInput.click();
fileInput.onchange = (e) => e.target.files[0] && handleFile(e.target.files[0]);
resetBtn.onclick = () => location.reload();
copyBtn.onclick = () => {
    navigator.clipboard.writeText(outputText.textContent);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = 'Copy Text', 2000);
};
downloadBtn.onclick = () => {
    const blob = new Blob([outputText.textContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-${Date.now()}.md`;
    a.click();
};

log('App initialized and ready.');
