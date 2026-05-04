export class OCREngine {
  constructor() {
    this.worker = null;
    this.isReady = false;
  }

  async init() {
    if (this.isReady) return;
    // Tesseract is global from the CDN
    this.worker = await Tesseract.createWorker('eng');
    this.isReady = true;
    console.log('OCR Engine ready');
  }

  async processImage(imageSource, onProgress) {
    if (!this.isReady) await this.init();
    
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
