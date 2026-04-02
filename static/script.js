// Initialize API instance
const api = new LegalMcpAPI();

// DOM elements
const form = document.getElementById('form');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const runBtn = document.getElementById('runBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
const output = document.getElementById('output');
const pdfPreview = document.getElementById('pdfPreview');
const clearBtn = document.getElementById('clearBtn');
const selectedFile = document.getElementById('selectedFile');
const fileSize = document.getElementById('fileSize');
const drop = document.getElementById('drop');

// Legal Document Generator elements
const inputText = document.getElementById('inputText');
const taskSelect = document.getElementById('taskSelect');
const languageSelect = document.getElementById('languageSelect');
const processBtn = document.getElementById('processBtn');
const clearTextBtn = document.getElementById('clearTextBtn');
const processStatus = document.getElementById('processStatus');
const processedOutput = document.getElementById('processedOutput');
const downloadProcessedBtn = document.getElementById('downloadProcessedBtn');
const copyProcessedBtn = document.getElementById('copyProcessedBtn');

// Initialize buttons as disabled
UIHelpers.disableButtons(runBtn, copyBtn, downloadProcessedBtn, copyProcessedBtn);

// Prevent default drag and drop behavior on the entire page
// but allow the drop area to handle its own events
document.addEventListener('dragover', (e) => {
  // Only prevent default if not over the drop area
  if (!drop.contains(e.target)) {
    e.preventDefault();
  }
});

document.addEventListener('drop', (e) => {
  // Only prevent default if not over the drop area
  if (!drop.contains(e.target)) {
    e.preventDefault();
  }
});

// Handle click to open file dialog
drop.addEventListener('click', () => {
  fileInput.click();
});

// Handle drag and drop
drop.addEventListener('dragover', (e) => { 
  e.preventDefault(); 
  e.stopPropagation();
  drop.style.borderColor = '#6aa7ff'; 
  drop.style.backgroundColor = '#1a1f2a';
});

drop.addEventListener('dragenter', (e) => {
  e.preventDefault();
  e.stopPropagation();
  drop.style.borderColor = '#6aa7ff';
  drop.style.backgroundColor = '#1a1f2a';
});

drop.addEventListener('dragleave', (e) => { 
  e.preventDefault();
  e.stopPropagation();
  // Only change color if we're actually leaving the drop area
  if (!drop.contains(e.relatedTarget)) {
    drop.style.borderColor = 'black';
    drop.style.backgroundColor = '';
  }
});

drop.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  drop.style.borderColor = 'black';
  drop.style.backgroundColor = '';
  
  console.log('Files dropped:', e.dataTransfer.files);
  
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    console.log('Processing file:', file.name, file.type);
    
    // Check if it's a PDF or image
    const fileName = file.name.toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].some(ext => fileName.endsWith(`.${ext}`));
    
    if (isPdf || isImage) {
      fileInput.files = e.dataTransfer.files;
      onFileChange();
    } else {
      alert('Please drop a PDF or image file (PNG, JPG, JPEG).');
    }
  }
});

fileInput.addEventListener('change', onFileChange);

// Copy button functionality
copyBtn.addEventListener('click', async () => {
  const text = output.value;
  if (!text.trim()) {
    alert('No text to copy');
    return;
  }
  
  try {
    await FileUtils.copyToClipboard(text);
    UIHelpers.showButtonSuccess(copyBtn);
  } catch (err) {
    alert('Text copied to clipboard');
  }
});

// Clear button functionality
clearBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileLabel.textContent = 'Drop or Click to upload PDFs or Images';
  document.getElementById('fileType').textContent = '';
  pdfPreview.innerHTML = '<p class="muted">File Preview</p>';
  UIHelpers.clearElements(output);
  UIHelpers.clearStatus(statusEl);
  UIHelpers.disableButtons(downloadBtn, runBtn, copyBtn);
  selectedFile.textContent = '';
  fileSize.textContent = '';
});



function onFileChange() {
  const f = fileInput.files?.[0];
  if (!f) { 
    fileLabel.textContent = 'Drop or Click to upload PDFs or Images'; 
    pdfPreview.innerHTML = '<p class="muted">File Preview</p>';
    document.getElementById('fileType').textContent = '';
    selectedFile.textContent = '';
    fileSize.textContent = '';
    UIHelpers.disableButtons(runBtn);
    return; 
  }
  
  // Get file extension
  const fileName = f.name;
  const fileExtension = FileUtils.getFileExtension(fileName);
  
  // Simple console log
  console.log('File uploaded:', fileName, 'Type:', fileExtension);
  
  // Determine file type
  let fileType = 'UNKNOWN';
  let isImage = false;
  if (fileExtension === 'pdf') {
    fileType = 'PDF';
  } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(fileExtension)) {
    fileType = fileExtension.toUpperCase();
    isImage = true;
  }
  
  // Update UI
  fileLabel.textContent = 'Selected File';
  const mb = FileUtils.formatFileSize(f.size);
  selectedFile.textContent = fileName;
  fileSize.textContent = `${fileType} (${mb} MB)`;
  
  // Enable run button
  UIHelpers.enableButtons(runBtn);
  
  // Create preview based on file type
  const fileURL = URL.createObjectURL(f);
  
  if (fileExtension === 'pdf') {
    pdfPreview.innerHTML = `
      <embed src="${fileURL}" type="application/pdf" width="100%" height="100%">
    `;
  } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(fileExtension)) {
    pdfPreview.innerHTML = `
      <img src="${fileURL}" alt="Image preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">
    `;
  } else {
    pdfPreview.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--muted);">
        <p>Preview not available for .${fileExtension} files</p>
      </div>
    `;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = fileInput.files?.[0];
  if (!f) { alert('Choose a PDF first.'); return; }

  UIHelpers.disableButtons(runBtn, downloadBtn);
  UIHelpers.clearElements(output);
  UIHelpers.setStatus(statusEl, 'Processing PDF');

  try {
    const data = await api.extractTextFromPDF(f);
    alert(`Processed ${data.num_pages} page(s).`);
    UIHelpers.clearStatus(statusEl);

    // Set the extracted text in the textarea
    output.value = data.full_text || '';
    
    // Enable download functionality
    UIHelpers.enableButtons(downloadBtn, copyBtn);
    downloadBtn.onclick = () => {
      const filename = (f.name.replace(/\.pdf$/i, '') || 'output') + '.txt';
      FileUtils.createDownloadBlob(data.full_text || '', filename);
    };
  } catch (err) {
    console.error(err);
    alert(`Error: ${err.message}`);
    UIHelpers.clearStatus(statusEl);
    UIHelpers.clearElements(output);
  } finally {
    UIHelpers.enableButtons(runBtn);
  }
});

// Process text with AI
processBtn.addEventListener('click', async () => {
  const text = inputText.value.trim();
  if (!text) {
    alert('Please enter some text to process.');
    return;
  }

  const task = taskSelect.value;
  const language = languageSelect.value;
  
  UIHelpers.disableButtons(processBtn, downloadProcessedBtn, copyProcessedBtn);
  UIHelpers.clearElements(processedOutput);
  UIHelpers.setStatus(processStatus, 'Processing with AI...');

  try {
    const data = await api.processTextWithAI(text, task, language);
    processedOutput.value = data.processed_text;
    UIHelpers.setStatus(processStatus, `AI processing completed (${task})`);

    // Enable download functionality
    UIHelpers.enableButtons(downloadProcessedBtn, copyProcessedBtn);
    downloadProcessedBtn.onclick = () => {
      const filename = `ai-processed-${task}.txt`;
      FileUtils.createDownloadBlob(data.processed_text, filename);
    };

  } catch (err) {
    console.error(err);
    UIHelpers.clearStatus(processStatus);
    processedOutput.value = `Error: ${err.message}`;
  } finally {
    UIHelpers.enableButtons(processBtn);
  }
});

// Clear text functionality
clearTextBtn.addEventListener('click', () => {
  UIHelpers.clearElements(inputText, processedOutput);
  UIHelpers.clearStatus(processStatus);
  UIHelpers.disableButtons(downloadProcessedBtn, copyProcessedBtn);
});

// Copy processed text functionality
copyProcessedBtn.addEventListener('click', async () => {
  const text = processedOutput.value;
  if (!text.trim()) {
    alert('No text to copy');
    return;
  }
  
  try {
    await FileUtils.copyToClipboard(text);
    UIHelpers.showButtonSuccess(copyProcessedBtn);
  } catch (err) {
    alert('Text copied to clipboard');
  }
});

// Tab functionality
document.addEventListener('DOMContentLoaded', function() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      this.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });

});


