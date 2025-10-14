const form = document.getElementById('form');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const fileMeta = document.getElementById('fileMeta');
const runBtn = document.getElementById('runBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');
const output = document.getElementById('output');
const maxPages = document.getElementById('max_pages');
const pdfPreview = document.getElementById('pdfPreview');
const clearBtn = document.getElementById('clearBtn');

const drop = document.getElementById('drop');

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

// Clear button functionality
clearBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileLabel.textContent = 'Drop or Click to upload PDFs or Images';
  fileMeta.textContent = '';
  document.getElementById('fileType').textContent = '';
  pdfPreview.innerHTML = '<p class="muted">File Preview</p>';
  output.innerHTML = '';
  statusEl.textContent = '';
  downloadBtn.disabled = true;
});
function onFileChange() {
  const f = fileInput.files?.[0];
  if (!f) { 
    fileLabel.textContent = 'Drop your file or click to choose'; 
    fileMeta.textContent = ''; 
    pdfPreview.innerHTML = '<p class="muted">File Preview</p>';
    document.getElementById('fileType').textContent = '';
    return; 
  }
  
  // Get file extension
  const fileName = f.name;
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
  
  // Simple console log
  console.log('File uploaded:', fileName, 'Type:', fileExtension);
  
  // Determine file type
  let fileType = 'UNKNOWN';
  if (fileExtension === 'pdf') {
    fileType = 'PDF';
  } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(fileExtension)) {
    fileType = fileExtension.toUpperCase();
  }
  
  // Update UI
  fileLabel.textContent = `Selected: ${fileName}`;
  const mb = (f.size / (1024*1024)).toFixed(2);
  fileMeta.textContent = `${mb} MB`;
  document.getElementById('fileType').textContent = `File Type: ${fileType}`;
  
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
  body.append('max_pages', maxPages.value || '0');

  try {
    const res = await fetch('/api/extract-text', { method: 'POST', body });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error (${res.status})`);
    }
    const data = await res.json();
    statusEl.textContent = `Processed ${data.num_pages} page(s).`;

    output.innerHTML = '';
    data.pages.forEach(p => {
      const div = document.createElement('div');
      div.className = 'page';
      const hdr = document.createElement('div');
      hdr.innerHTML = `<strong>Page ${p.page}</strong> <span class="pill">${p.source}</span>`;
      const pre = document.createElement('div');
      pre.textContent = p.text || '';
      div.appendChild(hdr);
      div.appendChild(document.createElement('div')).className = 'space';
      div.appendChild(pre);
      output.appendChild(div);
    });

    const blob = new Blob([data.full_text || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = url; a.download = (f.name.replace(/\.pdf$/i, '') || 'output') + '.txt';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  } catch (err) {
    console.error(err);
    statusEl.textContent = '';
    output.innerHTML = `<div class="page">${err.message}</div>`;
  } finally {
    runBtn.disabled = false;
  }
});
