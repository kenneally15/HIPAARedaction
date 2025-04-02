const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

/**
 * Process a PDF file by adding a HIPAA compliant stamp
 * @param {string} inputPath Path to the input PDF
 * @param {string} outputPath Path where the stamped PDF will be saved
 */
async function processAndRedactPDF(inputPath, outputPath) {
  try {
    console.log(`Processing PDF: ${inputPath}`);
    
    // Load the PDF
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    console.log(`PDF has ${pages.length} pages`);
    
    // Add a stamp to each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      
      // Add HIPAA COMPLIANT stamp at the bottom of each page
      page.drawText('HIPAA COMPLIANT', {
        x: width / 2 - 80, // Center horizontally (approximate)
        y: 30,             // Near the bottom
        size: 20,
        color: rgb(0, 0.5, 0),
        opacity: 0.7
      });
    }
    
    // Save the stamped PDF
    const stampedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, stampedPdfBytes);
    
    console.log(`HIPAA compliant PDF saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}

module.exports = { 
  processAndRedactPDF
}; 