import express from "express";
import {
  getAttendance,
  markAttendance,
  getStudentAttendance,
  getCourseSummary,
} from "../controllers/attendanceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes are protected (require lecturer/authenticated user)
router.use(protect);

// Get / mark attendance for a specific course
router.route("/:courseCode")
  .get(getAttendance)       // GET with ?date=YYYY-MM-DD
  .post(markAttendance);    // POST with body: { date, records: [{ studentId, status }] }

// Get summary for a course (attendance percentage per student)
router.get("/:courseCode/summary", getCourseSummary);

// Get attendance for a specific student (for student view)
router.get("/student/:studentId", getStudentAttendance);

export default router;