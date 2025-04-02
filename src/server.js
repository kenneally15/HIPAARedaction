const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processAndRedactPDF } = require('./utils/pdfProcessor');

const app = express();
const port = process.env.PORT || 3000;

// Configure file storage
const storage = multer.diskStorage({
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

    const inputPath = req.file.path;
    const outputPath = path.join(__dirname, '../uploads', `redacted-${path.basename(req.file.path)}`);
    
    await processAndRedactPDF(inputPath, outputPath);
    
    return res.json({ 
      success: true, 
      message: 'PDF processed successfully',
      downloadPath: `/download/${path.basename(outputPath)}`
    });
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
    res.status(404).send('File not found');
  }
});

app.listen(port, () => {
  console.log(`HIPAA Redaction app listening at http://localhost:${port}`);
}); 