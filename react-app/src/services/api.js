/**
 * API Service for communicating with the secure backend api.php proxy
 */

const getApiUrl = (action, params = {}) => {
  // If running locally, proxy to the live production server for easy testing
  const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://lingochaps.com/eps-tool/api.php'
    : 'api.php';

  const queryParams = new URLSearchParams({ action, ...params });
  return `${baseUrl}?${queryParams.toString()}`;
};

export const apiService = {
  /**
   * Creates a new conversion job with CloudConvert
   */
  async createJob(tasks) {
    const res = await fetch(getApiUrl('create-job'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Job creation failed: ${errText || res.statusText}`);
    }
    return res.json();
  },

  /**
   * Checks the status of an ongoing CloudConvert job
   */
  async checkJobStatus(jobId) {
    const res = await fetch(getApiUrl('check-status', { id: jobId }));
    if (!res.ok) {
      throw new Error(`Status check failed: ${res.statusText}`);
    }
    return res.json();
  },

  /**
   * Logs a successful user login to Google Sheets
   */
  async logLogin(name, email) {
    try {
      const res = await fetch(getApiUrl('log-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      return res.ok;
    } catch (err) {
      console.error('Failed to log login:', err);
      return false;
    }
  },

  /**
   * Calls the secure AI endpoint to translate text segments
   */
  async translateText(texts, targetLanguage) {
    const res = await fetch(getApiUrl('ai-translate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, targetLanguage })
    });
    if (!res.ok) {
      let errMessage = '';
      try {
        const errJson = await res.json();
        if (errJson && errJson.error) {
          errMessage = errJson.error;
          if (errJson.details?.error?.message) {
            errMessage += `: ${errJson.details.error.message}`;
          }
        }
      } catch (e) {
        // Fallback if response is not JSON
      }
      throw new Error(errMessage || `Server error (Status ${res.status})`);
    }
    return res.json();
  }
};

