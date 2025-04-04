document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input');
  const selectFileBtn = document.getElementById('select-file-btn');
  const fileInfo = document.getElementById('file-info');
  const filename = document.getElementById('filename');
  const uploadBtn = document.getElementById('upload-btn');
  const processingSection = document.getElementById('processing');
  const resultsSection = document.getElementById('results');
  const downloadBtn = document.getElementById('download-btn');
  const errorSection = document.getElementById('error');
  const errorMessage = document.getElementById('error-message');
  const tryAgainBtn = document.getElementById('try-again-btn');
  
  // State variables
  let selectedFile = null;
  let downloadUrl = null;
  
  // Set up drag and drop event listeners
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });
  
  function highlight() {
    dropArea.classList.add('highlight');
  }
  
  function unhighlight() {
    dropArea.classList.remove('highlight');
  }
  
  // Handle file drop
  dropArea.addEventListener('drop', handleDrop, false);
  
  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  }
  
  // Handle file selection via browse button
  selectFileBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
  });
  
  function handleFiles(files) {
    if (files.length > 0) {
      const file = files[0];
      
      // Check if the file is a PDF
      if (file.type !== 'application/pdf') {
        showError('Please select a PDF file.');
        return;
      }
      
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showError('Please select a PDF file smaller than 10MB.');
        return;
      }
      
      selectedFile = file;
      filename.textContent = file.name;
      fileInfo.classList.remove('hidden');
      uploadBtn.disabled = false;
    }
  }
  
  // Handle file upload
  uploadBtn.addEventListener('click', uploadFile);
  
  async function uploadFile() {
    if (!selectedFile) {
      return;
    }
    
    // Show processing state
    fileInfo.classList.add('hidden');
    processingSection.classList.remove('hidden');
    
    const formData = new FormData();
    formData.append('pdf', selectedFile);
    
    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server error: Expected JSON response but received a different format');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process the PDF file.');
      }
      
      // Show results
      processingSection.classList.add('hidden');
      resultsSection.classList.remove('hidden');
      downloadUrl = data.downloadPath;
    } catch (error) {
      processingSection.classList.add('hidden');
      showError(error.message || 'An error occurred during processing.');
    }
  }
  
  // Handle download
  downloadBtn.addEventListener('click', () => {
    if (downloadUrl) {
      window.location.href = downloadUrl;
    }
  });
  
  // Try again button
  tryAgainBtn.addEventListener('click', resetForm);
  
  // Show error message
  function showError(message) {
    errorMessage.textContent = message;
    errorSection.classList.remove('hidden');
  }
  
  // Reset form
  function resetForm() {
    // Reset state
    selectedFile = null;
    downloadUrl = null;
    
    // Reset UI
    fileInput.value = '';
    filename.textContent = 'No file selected';
    uploadBtn.disabled = true;
    
    // Hide sections
    errorSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    fileInfo.classList.add('hidden');
    
    // Show drop area
    dropArea.classList.remove('hidden');
  }
}); 