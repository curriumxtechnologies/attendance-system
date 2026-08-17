// attendanceService.js

import apiService from './apiService.js';

const attendanceService = {
  // Get attendance for a course on a date (optional query param ?date=YYYY-MM-DD)
  getAttendance(courseCode, date = null) {
    let endpoint = `/attendance/${courseCode}`;
    if (date) {
      endpoint += `?date=${date}`;
    }
    return apiService.get(endpoint);
  },

  // Mark attendance for a course on a date
  // records: [{ studentId, status }] where status = 'present' | 'absent' | 'excused'
  markAttendance(courseCode, records, date = null) {
    const body = { records };
    if (date) body.date = date;
    return apiService.post(`/attendance/${courseCode}`, body);
  },

  // Get attendance records for a specific student
  getStudentAttendance(studentId) {
    return apiService.get(`/attendance/student/${studentId}`);
  },

  // Get attendance summary for a course (percentage per student)
  getCourseSummary(courseCode) {
    return apiService.get(`/attendance/${courseCode}/summary`);
  },
};

export default attendanceService;