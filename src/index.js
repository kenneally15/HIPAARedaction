// Import the server module
const server = require('./server');

// The server is already configured to start in the server.js file
console.log('Starting HIPAA Redaction Application...'); 

// Export the Express app for Vercel
module.exports = server; 