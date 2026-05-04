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
    
    console.log('Starting OCR recognition...');
    try {
      const { data: { text } } = await this.worker.recognize(imageSource, {}, {
        logger: m => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(m.progress);
          }
        }
      });
      console.log('OCR recognition complete, text length:', text.length);
      return text;
    } catch (err) {
      console.error('OCR Error during recognize:', err);
      throw err;
    }
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.isReady = false;
    }
  }
}
