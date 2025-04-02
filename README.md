# HIPAA PDF Redaction Tool

This application helps you redact HIPAA-protected information from PDF documents. It automatically detects and obscures sensitive information such as:

- Names
- Social Security Numbers
- Medical Record Numbers
- Dates of Birth
- Addresses
- Phone numbers
- Email addresses
- IP addresses
- URLs
- Account numbers
- ZIP codes
- Age indicators

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

## Installation

1. Clone this repository:
   ```
   git clone <repository-url>
   cd HIPAARedaction
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Usage

1. Start the application:
   ```
   node src/index.js
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Upload a PDF document through the interface.

4. Once processing is complete, download the redacted PDF.

## Features

- **User-friendly interface**: Simple drag-and-drop functionality
- **Secure processing**: Files are processed locally on your server
- **Automatic detection**: Uses pattern recognition to identify PHI
- **Visual redaction**: Applies black boxes over sensitive information

## Important Note

While this tool strives to identify and redact HIPAA-related information, it should be used as part of a broader compliance strategy. Always manually review redacted documents before sharing to ensure all sensitive information has been removed.

## Development

### Project Structure

- `src/` - Server-side code
  - `components/` - Application components
  - `utils/` - Utility functions
- `public/` - Frontend assets
- `uploads/` - Temporary directory for uploaded and processed PDFs

### Adding New Patterns

To add new patterns for redaction, modify the `PATTERNS` object in `src/utils/pdfProcessor.js`.

## License

MIT 