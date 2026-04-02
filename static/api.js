// API functions for legal-mcp
// Handles API requests and Ollama-backed text processing (via backend)

const OLLAMA_IP_KEY = 'legalMcp.ollamaIp';
const OLLAMA_PORT_KEY = 'legalMcp.ollamaPort';
const OLLAMA_MODEL_KEY = 'legalMcp.ollamaModel';

class LegalMcpAPI {
  constructor() {
    this.baseURL = '';
  }

  /** @returns {{ ip: string, port: string, baseUrl: string, model: string }} */
  getOllamaConfig() {
    const ip = localStorage.getItem(OLLAMA_IP_KEY) || '127.0.0.1';
    const port = localStorage.getItem(OLLAMA_PORT_KEY) || '11434';
    const model = (localStorage.getItem(OLLAMA_MODEL_KEY) || '').trim();
    return {
      ip,
      port,
      baseUrl: `http://${ip}:${port}`,
      model,
    };
  }

  async fetchOllamaModels() {
    const { baseUrl } = this.getOllamaConfig();
    const url = `/api/ollama/models?base=${encodeURIComponent(baseUrl)}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Could not list models (${response.status})`);
    }
    return data;
  }

  // Extract text from PDF using pypdf only
  async extractTextFromPDF(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/extract-text', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Server error (${response.status})`);
    }

    return await response.json();
  }

  // Summarise text via backend (Ollama); host/model always read from Settings (localStorage).
  async summarizeText(text, language = 'english') {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('language', language);
    const { baseUrl, model } = this.getOllamaConfig();
    formData.append('ollama_base', baseUrl);
    formData.append('ollama_model', model);

    const response = await fetch('/api/process-text', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Server error (${response.status})`);
    }

    return await response.json();
  }

  // Health check
  async checkHealth() {
    const response = await fetch('/api/health');
    if (!response.ok) {
      throw new Error(`Health check failed (${response.status})`);
    }
    return await response.json();
  }
}

// Utility functions for file handling
class FileUtils {
  static createDownloadBlob(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  }

  static formatFileSize(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2);
  }

  static getFileExtension(filename) {
    return filename.split('.').pop()?.toLowerCase() || 'unknown';
  }

  static isPDFFile(file) {
    const fileName = file.name.toLowerCase();
    return file.type === 'application/pdf' || fileName.endsWith('.pdf');
  }
}

// UI Helper functions
class UIHelpers {
  static showButtonSuccess(button, successText = 'Copied', duration = 1500) {
    const originalText = button.textContent;
    const originalBackground = button.style.background;
    
    button.textContent = successText;
    button.style.background = '#28a745';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = originalBackground;
    }, duration);
  }

  static disableButtons(...buttons) {
    buttons.forEach(btn => {
      if (btn) btn.disabled = true;
    });
  }

  static enableButtons(...buttons) {
    buttons.forEach(btn => {
      if (btn) btn.disabled = false;
    });
  }

  static clearElements(...elements) {
    elements.forEach(el => {
      if (el) el.value = '';
    });
  }

  static setStatus(statusElement, message) {
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  static clearStatus(statusElement) {
    if (statusElement) {
      statusElement.textContent = '';
    }
  }
}

window.LegalMcpAPI = LegalMcpAPI;
window.FileUtils = FileUtils;
window.UIHelpers = UIHelpers;
window.LEGAL_MCP_OLLAMA_KEYS = {
  ip: OLLAMA_IP_KEY,
  port: OLLAMA_PORT_KEY,
  model: OLLAMA_MODEL_KEY,
};
