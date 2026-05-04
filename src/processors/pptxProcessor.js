// JSZip is global from the CDN

export async function processPPTX(file, ocrEngine, onProgress) {
  const zip = await JSZip.loadAsync(file);
  const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
  const totalSlides = slideFiles.length;
  let fullText = '';

  for (let i = 1; i <= totalSlides; i++) {
    onProgress({
      page: i,
      totalPages: totalSlides,
      status: `Processing slide ${i}/${totalSlides}...`
    });

    const slideName = `ppt/slides/slide${i}.xml`;
    const slideXml = await zip.file(slideName).async('string');
    
    // Extract text from XML (primitive regex approach for simplicity in browser)
    const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    let slideText = textMatches.map(m => m.replace(/<a:t>|<\/a:t>/g, '')).join(' ');

    fullText += `## Slide ${i}\n\n${slideText}\n\n`;
  }

  // Extract and OCR all media images to be sure
  const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
  if (mediaFiles.length > 0) {
    fullText += `\n\n### Extracted Images OCR\n\n`;
    for (let j = 0; j < mediaFiles.length; j++) {
      const imgName = mediaFiles[j];
      onProgress({
        page: totalSlides,
        totalPages: totalSlides,
        status: `OCRing media ${j + 1}/${mediaFiles.length}...`
      });

      const imgBlob = await zip.file(imgName).async('blob');
      const imgUrl = URL.createObjectURL(imgBlob);
      
      try {
        const text = await ocrEngine.processImage(imgUrl, null, (s) => {
          onProgress({
            page: totalSlides,
            totalPages: totalSlides,
            status: s
          });
        });
        if (text.trim()) {
          fullText += `#### Image: ${imgName.split('/').pop()}\n\n${text}\n\n`;
        }
      } catch (e) {
        console.error(`Failed to OCR ${imgName}`, e);
      }
      URL.revokeObjectURL(imgUrl);
    }
  }

  return fullText;
}
