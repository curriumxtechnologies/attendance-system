import asyncHandler from "express-async-handler";
import Attendance from "../models/attendanceModel.js";
import Student from "../models/studentModel.js";
import User from "../models/userModel.js";        // ✅ unified User model
import mongoose from "mongoose";

// @desc    Get attendance for a course on a given date
// @route   GET /api/attendance/:courseCode
// @access  Private (Lecturer)
const getAttendance = asyncHandler(async (req, res) => {
  const { courseCode } = req.params;
  const { date } = req.query; // optional, format YYYY-MM-DD

  const userId = req.user._id; // from protect middleware

  // Verify that the user is a lecturer and teaches this course
  const user = await User.findById(userId);
  if (!user || user.role !== "lecturer") {
    res.status(403);
    throw new Error("Access denied: only lecturers can view attendance");
  }
  if (!user.courses.includes(courseCode)) {
    res.status(403);
    throw new Error("You are not authorized to view attendance for this course");
  }

  // Parse date (default to today)
  let targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);

  const attendance = await Attendance.findOne({
    courseCode,
    date: targetDate,
    lecturer: userId,
  }).populate("records.student", "fullName matricNumber level department");

  if (!attendance) {
    // Return empty records with student list for that course
    const students = await Student.find({ "courses.code": courseCode })
      .select("fullName matricNumber level department")
      .lean();

    return res.status(200).json({
      success: true,
      courseCode,
      date: targetDate,
      records: students.map((s) => ({
        student: s,
        status: "absent", // default if not marked yet
      })),
      marked: false, // indicates no attendance record exists yet
    });
  }

  res.status(200).json({
    success: true,
    courseCode,
    date: targetDate,
    records: attendance.records,
    marked: true,
    attendanceId: attendance._id,
  });
});

// @desc    Mark attendance for a course on a specific date
// @route   POST /api/attendance/:courseCode
// @access  Private (Lecturer)
const markAttendance = asyncHandler(async (req, res) => {
  const { courseCode } = req.params;
  const { date, records } = req.body; // records: [{ studentId, status }]

  if (!records || !Array.isArray(records) || records.length === 0) {
    res.status(400);
    throw new Error("Records array is required with at least one student");
  }

  const userId = req.user._id;

  // Verify lecturer
  const user = await User.findById(userId);
  if (!user || user.role !== "lecturer") {
    res.status(403);
    throw new Error("Access denied: only lecturers can mark attendance");
  }
  if (!user.courses.includes(courseCode)) {
    res.status(403);
    throw new Error("You are not authorized to mark attendance for this course");
  }

  // Parse date (default today)
  let targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);

  // Validate student IDs and fetch their details
  const studentIds = records.map((r) => r.studentId);
  const students = await Student.find({ _id: { $in: studentIds } });
  if (students.length !== studentIds.length) {
    res.status(400);
    throw new Error("One or more student IDs are invalid");
  }

  // Verify each student is enrolled in this course
  const invalidStudents = students.filter(
    (s) => !s.courses.some((c) => c.code === courseCode)
  );
  if (invalidStudents.length > 0) {
    res.status(400);
    throw new Error(
      `Students ${invalidStudents.map((s) => s.matricNumber).join(", ")} are not enrolled in ${courseCode}`
    );
  }

  // Prepare records array for upsert
  const formattedRecords = records.map(({ studentId, status }) => ({
    student: studentId,
    status: status || "absent",
    markedAt: new Date(),
  }));

  // Use upsert to create or replace attendance for that day
  const attendance = await Attendance.findOneAndUpdate(
    { courseCode, date: targetDate, lecturer: userId },
    { $set: { records: formattedRecords } },
    { upsert: true, new: true, runValidators: true }
  ).populate("records.student", "fullName matricNumber level department");

  res.status(200).json({
    success: true,
    message: "Attendance marked successfully",
    attendance,
  });
});

// @desc    Get attendance for a specific student (for student portal)
// @route   GET /api/attendance/student/:studentId
// @access  Private (Student or Admin)
const getStudentAttendance = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  // Optional: check if the requesting user is the student or admin
  // For simplicity, we allow any authenticated user (but you can add role checks)

  const student = await Student.findById(studentId);
  if (!student) {
    res.status(404);
    throw new Error("Student not found");
  }

  // Get all attendance records where this student appears
  const attendances = await Attendance.find({
    "records.student": studentId,
  })
    .populate("lecturer", "fullName email staffId") // now populated from User
    .sort({ date: -1 });

  // Flatten records to show per course per date
  const result = attendances.map((att) => {
    const record = att.records.find((r) => r.student.toString() === studentId);
    return {
      courseCode: att.courseCode,
      date: att.date,
      status: record ? record.status : "absent",
      markedAt: record ? record.markedAt : null,
      lecturer: att.lecturer,
    };
  });

  res.status(200).json({
    success: true,
    student: {
      _id: student._id,
      fullName: student.fullName,
      matricNumber: student.matricNumber,
    },
    attendance: result,
  });
});

// @desc    Get summary statistics for a course (attendance percentage per student)
// @route   GET /api/attendance/:courseCode/summary
// @access  Private (Lecturer)
const getCourseSummary = asyncHandler(async (req, res) => {
  const { courseCode } = req.params;
  const userId = req.user._id;

  // Authorization
  const user = await User.findById(userId);
  if (!user || user.role !== "lecturer") {
    res.status(403);
    throw new Error("Access denied: only lecturers can view summaries");
  }
  if (!user.courses.includes(courseCode)) {
    res.status(403);
    throw new Error("You are not authorized to view this course's summary");
  }

  // Get all attendance documents for this course
  const allAttendances = await Attendance.find({ courseCode })
    .populate("records.student", "fullName matricNumber");

  // Get all students enrolled in this course
  const enrolledStudents = await Student.find({ "courses.code": courseCode })
    .select("_id fullName matricNumber");

  // Build per-student summary
  const summary = enrolledStudents.map((student) => {
    let presentCount = 0,
      absentCount = 0,
      excusedCount = 0;

    allAttendances.forEach((att) => {
      const record = att.records.find(
        (r) => r.student._id.toString() === student._id.toString()
      );
      if (record) {
        if (record.status === "present") presentCount++;
        else if (record.status === "absent") absentCount++;
        else if (record.status === "excused") excusedCount++;
      } else {
        // No record means the student was not marked – we consider absent
        absentCount++;
      }
    });

    const totalSessions = allAttendances.length;
    const percentage = totalSessions === 0 ? 0 : (presentCount / totalSessions) * 100;

    return {
      student: {
        _id: student._id,
        fullName: student.fullName,
        matricNumber: student.matricNumber,
      },
      present: presentCount,
      absent: absentCount,
      excused: excusedCount,
      totalSessions,
      percentage: Number(percentage.toFixed(2)),
    };
  });

  res.status(200).json({
    success: true,
    courseCode,
    totalSessions: allAttendances.length,
    summary,
  });
});

export {
  getAttendance,
  markAttendance,
  getStudentAttendance,
  getCourseSummary,
};