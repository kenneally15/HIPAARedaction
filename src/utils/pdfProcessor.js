const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const pdfjsLib = require('pdfjs-dist');
const natural = require('natural');
const { Canvas } = require('canvas');

// Set the pdf.js worker path to use Node.js
const PDFJS_WORKER_SRC = require.resolve('pdfjs-dist/build/pdf.worker.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;

// Define patterns for redaction
const NAME_PATTERNS = [
  /(?:Dr|Mr|Mrs|Ms|Miss)\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+/g, // Titles with names
  /[A-Z][a-z]+\s+[A-Z][a-z]+/g, // First and last names
  /[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+/g, // First, middle initial, and last names
];

const DATE_PATTERNS = [
  /\d{1,2}\/\d{1,2}\/\d{2,4}/g, // MM/DD/YYYY or DD/MM/YYYY
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{2,4}\b/g, // Month DD, YYYY
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+\d{2,4}\b/g, // DD Month YYYY
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{2,4}\b/g, // Full month name
  /\b\d{4}-\d{2}-\d{2}\b/g, // YYYY-MM-DD
];

// Setup NLP tokenizer for name entity recognition
const tokenizer = new natural.WordTokenizer();
const nameEntityRecognizer = new natural.BrillPOSTagger();

/**
 * Extract text content from a PDF
 * @param {Buffer|ArrayBuffer} pdfBytes The PDF file as bytes
 * @returns {Promise<Array>} Array of text content by page with position information
 */
async function extractTextFromPDF(pdfBytes) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const textContent = [];

    // Create a canvas for rendering if needed
    const canvas = new Canvas(1000, 1000);
    const context = canvas.getContext('2d');

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent_i = await page.getTextContent();
      
      textContent.push({
        pageNum: i,
        viewport,
        items: textContent_i.items.map(item => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
          fontName: item.fontName
        }))
      });
    }
    
    return textContent;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

/**
 * Find text matches based on regex patterns and NLP
 * @param {Array} textContentByPage Extracted text content from PDF
 * @returns {Array} Array of items to redact
 */
function findTextToRedact(textContentByPage) {
  const itemsToRedact = [];

  textContentByPage.forEach(page => {
    const pageText = page.items.map(item => item.text).join(' ');
    const tokens = tokenizer.tokenize(pageText);
    
    // Process each text item for pattern matches
    page.items.forEach(item => {
      let shouldRedact = false;
      
      // Check for name patterns
      for (const pattern of NAME_PATTERNS) {
        if (pattern.test(item.text)) {
          shouldRedact = true;
          break;
        }
      }
      
      // Check for date patterns
      if (!shouldRedact) {
        for (const pattern of DATE_PATTERNS) {
          if (pattern.test(item.text)) {
            shouldRedact = true;
            break;
          }
        }
      }
      
      // If we should redact this item, add it to our list
      if (shouldRedact) {
        itemsToRedact.push({
          pageNum: page.pageNum,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          text: item.text
        });
      }
    });
  });
  
  return itemsToRedact;
}

/**
 * Process a PDF file by redacting HIPAA information
 * @param {string} inputPath Path to the input PDF
 * @param {string} outputPath Path where the redacted PDF will be saved
 */
async function processAndRedactPDF(inputPath, outputPath) {
  try {
    console.log(`Processing PDF: ${inputPath}`);
    
    // Load the PDF
    const pdfBytes = fs.readFileSync(inputPath);
    const textContentByPage = await extractTextFromPDF(pdfBytes);
    
    // Find items to redact
    const itemsToRedact = findTextToRedact(textContentByPage);
    console.log(`Found ${itemsToRedact.length} items to redact`);
    
    // Load the PDF with pdf-lib for editing
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    console.log(`PDF has ${pages.length} pages`);
    
    // Add redaction rectangles to each page
    for (const item of itemsToRedact) {
      const page = pages[item.pageNum - 1];
      const { width, height } = page.getSize();
      
      // Draw a black rectangle over the text to redact
      // Adjust the y-coordinate since PDF coordinates start from the bottom
      const adjustedY = height - item.y;
      
      page.drawRectangle({
        x: item.x,
        y: adjustedY - item.height,
        width: item.width,
        height: item.height * 1.2, // Make slightly bigger to fully cover text
        color: rgb(0, 0, 0),
        opacity: 1
      });
    }
    
    // Add a stamp at the bottom of each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      
      // Add HIPAA COMPLIANT stamp at the bottom of each page
      page.drawText('HIPAA COMPLIANT - REDACTED', {
        x: width / 2 - 110, // Center horizontally (approximate)
        y: 30,             // Near the bottom
        size: 16,
        color: rgb(0, 0.5, 0),
        opacity: 0.8
      });
    }
    
    // Save the redacted PDF
    const redactedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, redactedPdfBytes);
    
    console.log(`Redacted PDF saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}

module.exports = { 
  processAndRedactPDF
}; 