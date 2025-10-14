const form = document.getElementById('form');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const fileMeta = document.getElementById('fileMeta');
const runBtn = document.getElementById('runBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
const output = document.getElementById('output');
const pdfPreview = document.getElementById('pdfPreview');
const clearBtn = document.getElementById('clearBtn');
const extractImageBtn = document.getElementById('extractImageBtn');
const selectedFile = document.getElementById('selectedFile');
const fileSize = document.getElementById('fileSize');

const drop = document.getElementById('drop');

// Initialize buttons as disabled
extractImageBtn.disabled = true;
runBtn.disabled = true;
copyBtn.disabled = true;

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
    await navigator.clipboard.writeText(text);
    // Temporarily change button text to show success
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied';
    copyBtn.style.background = '#28a745';
    
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.background = '';
    }, 1500);
  } catch (err) {
    // Fallback for older browsers
    output.select();
    document.execCommand('copy');
    alert('Text copied to clipboard');
  }
});

// Clear button functionality
clearBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileLabel.textContent = 'Drop or Click to upload PDFs or Images';
  fileMeta.textContent = '';
  document.getElementById('fileType').textContent = '';
  pdfPreview.innerHTML = '<p class="muted">File Preview</p>';
  output.value = '';
  statusEl.textContent = '';
  downloadBtn.disabled = true;
  selectedFile.textContent = '';
  fileSize.textContent = '';
  // Disable both buttons when cleared
  extractImageBtn.disabled = true;
  runBtn.disabled = true;
  copyBtn.disabled = true;
});

// Image extraction handler
extractImageBtn.addEventListener('click', async () => {
  const f = fileInput.files?.[0];
  if (!f) { 
    alert('Choose an image file first.'); 
    return; 
  }

  // Check if it's an image file
  if (!f.type.startsWith('image/')) {
    alert('Please select an image file (PNG, JPG, JPEG).');
    return;
  }

  extractImageBtn.disabled = true;
  runBtn.disabled = true;
  downloadBtn.disabled = true;
  output.value = '';
  
  // Show progress bar
  statusEl.innerHTML = `
    <div style="background: #1a1f2a; border-radius: 8px; padding: 8px; margin: 8px 0;">
      <div style="color: #6aa7ff; font-size: 14px; margin-bottom: 4px;">Processing image with OCR</div>
      <div style="background: #0b0f14; height: 8px; border-radius: 4px; overflow: hidden;">
        <div id="progressBar" style="background: #6aa7ff; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
      </div>
      <div id="progressText" style="color: #9fb3c8; font-size: 12px; margin-top: 4px;">Starting...</div>
    </div>
  `;

  // Simulate progress updates
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  const updateProgress = (percent) => {
    progressBar.style.width = percent + '%';
  };

  // Start progress simulation
  updateProgress(10);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  updateProgress(25);
  await new Promise(resolve => setTimeout(resolve, 300));
  
  updateProgress(40);
  await new Promise(resolve => setTimeout(resolve, 800));

  const body = new FormData();
  body.append('file', f);

  try {
    updateProgress(60);
    
    const res = await fetch('/api/extract-image', { method: 'POST', body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    updateProgress(90);
    await new Promise(resolve => setTimeout(resolve, 200));

    const data = await res.json();
    output.value = data.extracted_text;
    
    updateProgress(100);
    setTimeout(() => {
      statusEl.textContent = `OCR completed: ${data.filename}`;
    }, 500);
    
    downloadBtn.disabled = false;
    copyBtn.disabled = false;

  } catch (err) {
    output.value = `Error: ${err.message}`;
    statusEl.textContent = 'OCR failed';
  } finally {
    extractImageBtn.disabled = false;
    runBtn.disabled = false;
  }
});
function onFileChange() {
  const f = fileInput.files?.[0];
  if (!f) { 
    fileLabel.textContent = 'Drop or Click to upload PDFs or Images'; 
    fileMeta.textContent = ''; 
    pdfPreview.innerHTML = '<p class="muted">File Preview</p>';
    document.getElementById('fileType').textContent = '';
    selectedFile.textContent = '';
    fileSize.textContent = '';
    // Disable both buttons when no file
    extractImageBtn.disabled = true;
    runBtn.disabled = true;
    return; 
  }
  
  // Get file extension
  const fileName = f.name;
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
  
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
  const mb = (f.size / (1024*1024)).toFixed(2);
  selectedFile.textContent = fileName;
  fileSize.textContent = `${fileType} (${mb} MB)`;
  
  // Enable/disable buttons based on file type
  extractImageBtn.disabled = !isImage;  // Only enable for images
  runBtn.disabled = false;  // Always enable for PDFs and images
  
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

  runBtn.disabled = true; downloadBtn.disabled = true; output.textContent = ''; statusEl.textContent = 'Uploading…';

  const body = new FormData();
  body.append('file', f);

  try {
    const res = await fetch('/api/extract-text', { method: 'POST', body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error (${res.status})`);
    }
    const data = await res.json();
    statusEl.textContent = `Processed ${data.num_pages} page(s).`;

    // Set the extracted text in the textarea
    output.value = data.full_text || '';
    
    // Enable download functionality
    const blob = new Blob([data.full_text || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    downloadBtn.disabled = false;
    copyBtn.disabled = false;
    downloadBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = url; a.download = (f.name.replace(/\.pdf$/i, '') || 'output') + '.txt';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  } catch (err) {
    console.error(err);
    statusEl.textContent = '';
    output.value = `Error: ${err.message}`;
  } finally {
    runBtn.disabled = false;
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
