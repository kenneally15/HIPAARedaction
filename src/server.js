const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processAndRedactPDF } = require('./utils/pdfProcessor');
// Add Vercel Blob import
const { put, del, list, get } = process.env.VERCEL ? require('@vercel/blob') : { put: null, del: null, list: null, get: null };

const app = express();
const port = process.env.PORT || 3000;

// Configure file storage for different environments
let storage;

// Check if we're running on Vercel
if (process.env.VERCEL) {
  // For Vercel, use memory storage
  storage = multer.memoryStorage();
} else {
  // For local development, use disk storage
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  });
}

// Create file filter for PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Handle PDF upload
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    let blobUrl = null;
    
    if (process.env.VERCEL) {
      try {
        // When on Vercel, use Vercel Blob storage
        const filename = `${Date.now()}-${req.file.originalname}`;
        const redactedFilename = `redacted-${filename}`;
        
        // Upload the original file to Vercel Blob temporarily
        const originalBlob = await put(filename, req.file.buffer, {
          access: 'private', // Make original private for security
          contentType: 'application/pdf'
        });
        
        // Process the PDF in memory
        const { PDFDocument } = require('pdf-lib');
        const pdfProcessor = require('./utils/pdfProcessor');
        
        // Load PDF and process it
        const pdfDoc = await PDFDocument.load(req.file.buffer);
        
        // Create a new temporary directory for processing
        const tempDir = `/tmp/pdf-processing-${Date.now()}`;
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempInputPath = `${tempDir}/${filename}`;
        const tempOutputPath = `${tempDir}/${redactedFilename}`;
        
        // Write the original PDF to temp directory
        fs.writeFileSync(tempInputPath, req.file.buffer);
        
        // Process and redact the PDF
        await pdfProcessor.processAndRedactPDF(tempInputPath, tempOutputPath);
        
        // Read the processed file
        const redactedPdfBuffer = fs.readFileSync(tempOutputPath);
        
        // Upload the redacted file to Vercel Blob
        const redactedBlob = await put(redactedFilename, redactedPdfBuffer, {
          access: 'public',
          contentType: 'application/pdf'
        });
        
        // Clean up temp files
        try {
          fs.unlinkSync(tempInputPath);
          fs.unlinkSync(tempOutputPath);
          fs.rmdirSync(tempDir);
        } catch (cleanupError) {
          console.error('Error cleaning up temp files:', cleanupError);
          // Continue anyway
        }
        
        // Delete the original file from Blob storage (optional)
        try {
          await del(originalBlob.url);
        } catch (deleteError) {
          console.error('Error deleting original blob:', deleteError);
          // Continue anyway
        }
        
        blobUrl = redactedBlob.url;
        
        return res.json({ 
          success: true, 
          message: 'PDF processed and redacted successfully',
          downloadPath: blobUrl, // Direct URL to the redacted blob
          filename: redactedFilename
        });
      } catch (blobError) {
        console.error('Vercel Blob error:', blobError);
        return res.status(500).json({ error: 'Failed to process PDF in Vercel environment' });
      }
    } else {
      // Local development with file access
      const inputPath = req.file.path;
      const outputPath = path.join(__dirname, '../uploads', `redacted-${path.basename(req.file.path)}`);
      
      await processAndRedactPDF(inputPath, outputPath);
      
      return res.json({ 
        success: true, 
        message: 'PDF processed and redacted successfully',
        downloadPath: `/download/${path.basename(outputPath)}`
      });
    }
  } catch (error) {
    console.error('Error processing PDF:', error);
    return res.status(500).json({ error: 'Failed to process PDF' });
  }
});

// Serve processed PDFs
app.get('/download/:filename', (req, res) => {
  // For local environment only
  if (!process.env.VERCEL) {
    const filePath = path.join(__dirname, '../uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } else {
    // For Vercel environment, should not reach here as we use direct Blob URLs
    res.status(404).json({ error: 'File not found. In Vercel environment, use direct Blob URLs.' });
  }
});

// Only start the server if not on Vercel
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`HIPAA Redaction app listening at http://localhost:${port}`);
  });
}

// Export the app for serverless environments
module.exports = app; 