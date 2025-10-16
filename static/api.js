// API functions for legal-atlas
// Handles all API requests and OpenAI processing

class LegalAtlasAPI {
  constructor() {
    this.baseURL = '';
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

  // Process text using OpenAI API
  async processTextWithAI(text, task = 'analyze', language = 'english') {
    const formData = new FormData();
    formData.append('text', text);
    formData.append('task', task);
    formData.append('language', language);

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

  static isImageFile(file) {
    const fileName = file.name.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    return imageExtensions.some(ext => fileName.endsWith(`.${ext}`));
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

// Export for use in other files
window.LegalAtlasAPI = LegalAtlasAPI;
window.FileUtils = FileUtils;
window.UIHelpers = UIHelpers;
