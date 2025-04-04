const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processAndRedactPDF } = require('./utils/pdfProcessor');

const app = express();
const port = process.env.PORT || 3000;

// Configure file storage for different environments
let storage;

// Check if we're running on Vercel
if (process.env.VERCEL) {
  // For Vercel, use memory storage (temporary solution)
  // In production, you should use a cloud storage solution like S3
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

    let inputPath;
    let outputPath;
    
    if (process.env.VERCEL) {
      // When on Vercel, we can't reliably use the filesystem
      // This is a simplified response for demonstration
      return res.json({ 
        success: true, 
        message: 'PDF received successfully (Note: Full processing disabled on Vercel demo)',
        downloadPath: '#' // No actual download in this demo version
      });
    } else {
      // Local development with file access
      inputPath = req.file.path;
      outputPath = path.join(__dirname, '../uploads', `redacted-${path.basename(req.file.path)}`);
      
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
  const filePath = path.join(__dirname, '../uploads', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
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