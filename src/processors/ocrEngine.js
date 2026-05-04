export class OCREngine {
  constructor() {
    this.worker = null;
    this.isReady = false;
  }

  async init(onStatus) {
    if (this.isReady) return;
    if (onStatus) onStatus('Loading OCR Engine (Tesseract)...');
    
    // Tesseract is global from the CDN
    this.worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract' || m.status === 'loading language traineddata') {
          if (onStatus) onStatus(`${m.status} (${Math.round(m.progress * 100)}%)...`);
        }
      }
    });
    
    this.isReady = true;
    if (onStatus) onStatus('OCR Engine Ready!');
    console.log('OCR Engine ready');
  }

  async processImage(imageSource, onProgress, onStatus) {
    if (!this.isReady) await this.init(onStatus);
    
    const { data: { text } } = await this.worker.recognize(imageSource, {
      rotateAuto: true,
    }, {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(m.progress);
        }
      }
    });

    return text;
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.isReady = false;
    }
  }
}
