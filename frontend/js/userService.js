// userService.js

import apiService from './apiService.js';

const userService = {
  // Registration
  async register(data) {
    return apiService.post('/lecturers/register', data);
  },

  // Login
  async login(identifier, password) {
    return apiService.post('/lecturers/login', { identifier, password });
  },

  // Verify OTP
  async verifyOTP({ email, otp, purpose, tempToken }) {
    return apiService.post('/lecturers/verify-otp', { email, otp, purpose, tempToken });
  },

  // Forgot password – send OTP
  async forgotPassword(email) {
    return apiService.post('/lecturers/forgot-password', { email });
  },

  // Reset password using resetToken
  async resetPassword(resetToken, newPassword) {
    return apiService.post('/lecturers/reset-password', { resetToken, newPassword });
  },

  // Get current lecturer info (requires auth)
  async getMe() {
    return apiService.get('/lecturers/me');
  },

  // Logout (clears token)
  async logout() {
    const res = await apiService.post('/lecturers/logout', {});
    apiService.setToken(null); // clear local token
    return res;
  },

  // Update profile (supports file upload for profile picture)
  async updateProfile(formData) {
    // formData should include 'profilePicture' (file), 'password', 'courses' etc.
    return apiService.put('/lecturers/update', formData, true); // true = isFormData
  },

  // Toggle two-factor authentication
  async toggle2FA() {
    return apiService.put('/lecturers/toggle-2fa', {});
  },

  // Get all lecturers (admin only)
  async getAllLecturers(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    const endpoint = query ? `/lecturers?${query}` : '/lecturers';
    return apiService.get(endpoint);
  },
};

export default userService;