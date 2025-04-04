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
        
        // Upload file to Vercel Blob
        const blob = await put(filename, req.file.buffer, {
          access: 'public',
          contentType: 'application/pdf'
        });
        
        blobUrl = blob.url;
        
        // In a real app, we would process the PDF here with Vercel Blob
        // For demo, we're just storing and returning the URL
        
        return res.json({ 
          success: true, 
          message: 'PDF uploaded to Vercel Blob successfully',
          downloadPath: blobUrl, // Direct URL to the blob
          filename: filename // Store the filename for reference
        });
      } catch (blobError) {
        console.error('Vercel Blob error:', blobError);
        return res.status(500).json({ error: 'Failed to store file in Vercel Blob' });
      }
    } else {
      // Local development with file access
      const inputPath = req.file.path;
      const outputPath = path.join(__dirname, '../uploads', `redacted-${path.basename(req.file.path)}`);
      
      await processAndRedactPDF(inputPath, outputPath);
      
      return res.json({ 
        success: true, 
        message: 'PDF processed successfully',
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