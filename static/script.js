const api = new LegalMcpAPI();

const LS_OLLAMA_IP = window.LEGAL_MCP_OLLAMA_KEYS?.ip || 'legalMcp.ollamaIp';
const LS_OLLAMA_PORT = window.LEGAL_MCP_OLLAMA_KEYS?.port || 'legalMcp.ollamaPort';
const LS_OLLAMA_MODEL = window.LEGAL_MCP_OLLAMA_KEYS?.model || 'legalMcp.ollamaModel';

function updateGlobalOllamaHint() {
  const el = document.getElementById('globalOllamaHint');
  if (!el) return;
  const c = api.getOllamaConfig();
  const modelPart = c.model ? c.model : '(no model selected — set in Settings)';
  el.textContent = `Using ${c.baseUrl} · ${modelPart}`;
}

function wireOllamaSettings() {
  const ipInput = document.getElementById('ollamaIpInput');
  const portInput = document.getElementById('ollamaPortInput');
  const modelSelect = document.getElementById('ollamaModelSelect');
  const basePreview = document.getElementById('ollamaBasePreview');
  const statusEl = document.getElementById('ollamaSettingsStatus');
  const refreshBtn = document.getElementById('ollamaRefreshBtn');
  if (!ipInput || !portInput || !modelSelect || !refreshBtn || !basePreview) return;

  function updatePreview() {
    const ip = ipInput.value.trim() || '127.0.0.1';
    const port = portInput.value.trim() || '11434';
    basePreview.textContent = `Base URL: http://${ip}:${port}`;
  }

  function persistFromInputs() {
    localStorage.setItem(LS_OLLAMA_IP, ipInput.value.trim() || '127.0.0.1');
    localStorage.setItem(LS_OLLAMA_PORT, portInput.value.trim() || '11434');
    updatePreview();
  }

  function loadFromStorage() {
    ipInput.value = localStorage.getItem(LS_OLLAMA_IP) || '127.0.0.1';
    portInput.value = localStorage.getItem(LS_OLLAMA_PORT) || '11434';
    updatePreview();
  }

  async function refreshModels() {
    persistFromInputs();
    UIHelpers.setStatus(statusEl, 'Loading models…');
    refreshBtn.disabled = true;
    try {
      const data = await api.fetchOllamaModels();
      const models = data.models || [];
      const previous = modelSelect.value;
      modelSelect.innerHTML = '';
      if (models.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(no models reported)';
        modelSelect.appendChild(opt);
      } else {
        models.forEach((name) => {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          modelSelect.appendChild(opt);
        });
      }
      const saved = localStorage.getItem(LS_OLLAMA_MODEL) || '';
      let chosen = '';
      if (saved && [...modelSelect.options].some((o) => o.value === saved)) {
        chosen = saved;
      } else if (previous && [...modelSelect.options].some((o) => o.value === previous)) {
        chosen = previous;
      } else if (models.length > 0) {
        chosen = modelSelect.options[0].value;
      }
      modelSelect.value = chosen;
      if (chosen) {
        localStorage.setItem(LS_OLLAMA_MODEL, chosen);
      }
      UIHelpers.setStatus(statusEl, `${models.length} model(s) — ${data.host || ''}`);
      updateGlobalOllamaHint();
    } catch (err) {
      UIHelpers.setStatus(statusEl, '');
      alert(`Refresh failed: ${err.message}`);
    } finally {
      refreshBtn.disabled = false;
    }
  }

  ipInput.addEventListener('change', persistFromInputs);
  portInput.addEventListener('change', persistFromInputs);
  ipInput.addEventListener('input', () => {
    updatePreview();
    persistFromInputs();
    updateGlobalOllamaHint();
  });
  portInput.addEventListener('input', () => {
    updatePreview();
    persistFromInputs();
    updateGlobalOllamaHint();
  });

  modelSelect.addEventListener('change', () => {
    localStorage.setItem(LS_OLLAMA_MODEL, modelSelect.value);
    updateGlobalOllamaHint();
  });

  refreshBtn.addEventListener('click', (e) => {
    e.preventDefault();
    refreshModels();
  });

  loadFromStorage();
  localStorage.setItem(LS_OLLAMA_IP, ipInput.value.trim() || '127.0.0.1');
  localStorage.setItem(LS_OLLAMA_PORT, portInput.value.trim() || '11434');
  updateGlobalOllamaHint();
}

function wireAccordions() {
  document.querySelectorAll('.accordion-trigger').forEach((btn) => {
    const panelId = btn.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;

    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
  });
}

function wirePdfExtractor() {
  const form = document.getElementById('form');
  const fileInput = document.getElementById('fileInput');
  const fileLabel = document.getElementById('fileLabel');
  const fileTypeEl = document.getElementById('fileType');
  const runBtn = document.getElementById('runBtn');
  const clearBtn = document.getElementById('clearBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');
  const statusEl = document.getElementById('status');
  const output = document.getElementById('output');
  const pdfPreview = document.getElementById('pdfPreview');
  const selectedFile = document.getElementById('selectedFile');
  const fileSize = document.getElementById('fileSize');
  const drop = fileInput.closest('.drop-area');

  function onFileChange() {
    const f = fileInput.files?.[0];
    if (!f) {
      fileLabel.textContent = 'Drop or click to upload a PDF';
      pdfPreview.innerHTML = '<p class="muted">File Preview</p>';
      fileTypeEl.textContent = '';
      selectedFile.textContent = '';
      fileSize.textContent = '';
      UIHelpers.disableButtons(runBtn);
      return;
    }

    const fileName = f.name;
    const fileExtension = FileUtils.getFileExtension(fileName);

    if (fileExtension !== 'pdf' && f.type !== 'application/pdf') {
      fileLabel.textContent = 'Drop or click to upload a PDF';
      pdfPreview.innerHTML = '<p class="muted">File Preview</p>';
      selectedFile.textContent = '';
      fileSize.textContent = '';
      UIHelpers.disableButtons(runBtn);
      alert('Only PDF files are supported.');
      fileInput.value = '';
      return;
    }

    fileLabel.textContent = 'Selected file';
    const mb = FileUtils.formatFileSize(f.size);
    selectedFile.textContent = fileName;
    fileSize.textContent = `PDF (${mb} MB)`;

    UIHelpers.enableButtons(runBtn);

    const fileURL = URL.createObjectURL(f);
    pdfPreview.innerHTML = `
      <embed src="${fileURL}" type="application/pdf" width="100%" height="100%">
    `;
  }

  drop.addEventListener('click', () => fileInput.click());

  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.style.borderColor = '#a3cdff';
    drop.style.backgroundColor = '#1c2430';
  });

  drop.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.style.borderColor = '#a3cdff';
    drop.style.backgroundColor = '#1c2430';
  });

  drop.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const fileName = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || fileName.endsWith('.pdf');

      if (isPdf) {
        fileInput.files = e.dataTransfer.files;
        onFileChange();
      } else {
        alert('Please drop a PDF file.');
      }
    }
  });

  fileInput.addEventListener('change', onFileChange);

  copyBtn.addEventListener('click', async () => {
    const text = output.value;
    if (!text.trim()) {
      alert('No text to copy');
      return;
    }
    try {
      await FileUtils.copyToClipboard(text);
      UIHelpers.showButtonSuccess(copyBtn);
    } catch (_err) {
      alert('Text copied to clipboard');
    }
  });

  clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileLabel.textContent = 'Drop or click to upload a PDF';
    fileTypeEl.textContent = '';
    pdfPreview.innerHTML = '<p class="muted">File Preview</p>';
    UIHelpers.clearElements(output);
    UIHelpers.clearStatus(statusEl);
    UIHelpers.disableButtons(downloadBtn, runBtn, copyBtn);
    selectedFile.textContent = '';
    fileSize.textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = fileInput.files?.[0];
    if (!f) {
      alert('Choose a PDF first.');
      return;
    }
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are supported.');
      return;
    }

    UIHelpers.disableButtons(runBtn, downloadBtn);
    UIHelpers.clearElements(output);
    UIHelpers.setStatus(statusEl, 'Extracting text from PDF…');

    try {
      const data = await api.extractTextFromPDF(f);
      alert(`Processed ${data.num_pages} page(s).`);
      UIHelpers.clearStatus(statusEl);

      output.value = data.full_text || '';

      UIHelpers.enableButtons(downloadBtn, copyBtn);
      downloadBtn.onclick = () => {
        const base = f.name.replace(/\.[^/.]+$/, '') || 'output';
        FileUtils.createDownloadBlob(data.full_text || '', `${base}.txt`);
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
}

function wireLegalGenerator() {
  const inputText = document.getElementById('inputText');
  const languageSelect = document.getElementById('languageSelect');
  const processBtn = document.getElementById('processBtn');
  const clearTextBtn = document.getElementById('clearTextBtn');
  const processStatus = document.getElementById('processStatus');
  const processedOutput = document.getElementById('processedOutput');
  const downloadProcessedBtn = document.getElementById('downloadProcessedBtn');
  const copyProcessedBtn = document.getElementById('copyProcessedBtn');

  if (!inputText || !processBtn || !clearTextBtn || !processStatus || !processedOutput || !downloadProcessedBtn || !copyProcessedBtn) {
    return;
  }

  const processBtnDefaultLabel = processBtn.textContent.trim();

  processBtn.addEventListener('click', async () => {
    const text = inputText.value.trim();
    if (!text) {
      alert('Please enter some text to summarise.');
      return;
    }

    const cfg = api.getOllamaConfig();
    if (!cfg.model) {
      alert('Choose an Ollama model in Settings (refresh the list, then pick a model).');
      return;
    }

    const language = languageSelect ? languageSelect.value : 'english';

    UIHelpers.disableButtons(downloadProcessedBtn, copyProcessedBtn);
    processBtn.disabled = true;
    processBtn.setAttribute('aria-busy', 'true');
    processBtn.textContent = 'Waiting for Ollama';
    UIHelpers.clearElements(processedOutput);

    try {
      const data = await api.summarizeText(text, language);
      processedOutput.value = data.processed_text;
      UIHelpers.setStatus(processStatus, 'Summary ready');

      UIHelpers.enableButtons(downloadProcessedBtn, copyProcessedBtn);
      downloadProcessedBtn.onclick = () => {
        FileUtils.createDownloadBlob(data.processed_text, 'summary.txt');
      };
    } catch (err) {
      console.error(err);
      UIHelpers.clearStatus(processStatus);
      processedOutput.value = `Error: ${err.message}`;
    } finally {
      processBtn.disabled = false;
      processBtn.removeAttribute('aria-busy');
      processBtn.textContent = processBtnDefaultLabel;
    }
  });

  clearTextBtn.addEventListener('click', () => {
    UIHelpers.clearElements(inputText, processedOutput);
    UIHelpers.clearStatus(processStatus);
    UIHelpers.disableButtons(downloadProcessedBtn, copyProcessedBtn);
  });

  copyProcessedBtn.addEventListener('click', async () => {
    const text = processedOutput.value;
    if (!text.trim()) {
      alert('No text to copy');
      return;
    }
    try {
      await FileUtils.copyToClipboard(text);
      UIHelpers.showButtonSuccess(copyProcessedBtn);
    } catch (_err) {
      alert('Text copied to clipboard');
    }
  });
}

document.addEventListener('dragover', (e) => {
  if (!e.target.closest('.drop-area')) {
    e.preventDefault();
  }
});

document.addEventListener('drop', (e) => {
  if (!e.target.closest('.drop-area')) {
    e.preventDefault();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  wirePdfExtractor();
  wireLegalGenerator();
  wireOllamaSettings();
  wireAccordions();
  UIHelpers.disableButtons(
    document.getElementById('runBtn'),
    document.getElementById('copyBtn'),
    document.getElementById('downloadProcessedBtn'),
    document.getElementById('copyProcessedBtn')
  );

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach((button) => {
    button.addEventListener('click', function () {
      const targetTab = this.getAttribute('data-tab');
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      tabContents.forEach((content) => content.classList.remove('active'));
      this.classList.add('active');
      const panel = document.getElementById(targetTab);
      if (panel) panel.classList.add('active');
      if (targetTab === 'tools') {
        updateGlobalOllamaHint();
      }
    });
  });
});
