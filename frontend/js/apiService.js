// apiService.js

const BASE_URL = 'http://127.0.0.1:8000/api';

const apiService = {
  // Get stored token from localStorage
  getToken() {
    return localStorage.getItem('authToken');
  },

  // Set token in localStorage (and optionally in headers)
  setToken(token) {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  },

  // Build headers with Authorization if token exists
  getHeaders(contentType = 'application/json') {
    const headers = {
      'Content-Type': contentType,
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  // Generic request method
  async request(endpoint, method = 'GET', body = null, isFormData = false) {
    const url = `${BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: isFormData ? {} : this.getHeaders(),
    };

    if (body) {
      if (isFormData) {
        options.body = body;
        // Do NOT set Content-Type – browser sets it with boundary
      } else {
        options.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, options);

    // Parse JSON response (even errors may have JSON)
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { success: false, message: 'Invalid response from server' };
    }

    if (!response.ok) {
      // If token expired, clear it
      if (response.status === 401) {
        this.setToken(null);
      }
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  },

  // Convenience methods
  get(endpoint) {
    return this.request(endpoint, 'GET');
  },

  post(endpoint, body, isFormData = false) {
    return this.request(endpoint, 'POST', body, isFormData);
  },

  put(endpoint, body, isFormData = false) {
    return this.request(endpoint, 'PUT', body, isFormData);
  },

  delete(endpoint) {
    return this.request(endpoint, 'DELETE');
  },
};

export default apiService;