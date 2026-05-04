// pdfjsLib is global from the CDN
const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function processPDF(file, ocrEngine, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  let fullText = '';

  for (let i = 1; i <= totalPages; i++) {
    onProgress({
      page: i,
      totalPages,
      status: `Rendering page ${i}/${totalPages}...`
    });

    onProgress({
      page: i,
      totalPages,
      status: `Fetching page ${i}/${totalPages}...`
    });

    const page = await pdf.getPage(i);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const scale = isMobile ? 1.2 : 2.0; // Further reduced for stability
    const viewport = page.getViewport({ scale });
    
    onProgress({
      page: i,
      totalPages,
      status: `Rendering page ${i} (Scale: ${scale})...`
    });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    try {
      await page.render({ canvasContext: context, viewport }).promise;
      onProgress({
        page: i,
        totalPages,
        status: `Render complete for page ${i}. Starting OCR...`
      });
    } catch (renderErr) {
      onProgress({
        page: i,
        totalPages,
        status: `RENDER ERROR: ${renderErr.message}`
      });
      throw renderErr;
    }

    const text = await ocrEngine.processImage(canvas, (p) => {
      onProgress({
        page: i,
        totalPages,
        progress: p,
        status: `OCRing page ${i}/${totalPages} (${Math.round(p * 100)}%)...`
      });
    }, (s) => {
      onProgress({
        page: i,
        totalPages,
        status: s
      });
    });

    fullText += `## Page ${i}\n\n${text}\n\n---\n\n`;
  }

  return fullText;
}
