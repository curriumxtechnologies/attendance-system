import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    courseCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      default: () => new Date().setHours(0, 0, 0, 0), // store only date (no time)
      index: true,
    },
    lecturer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecturer",
      required: true,
    },
    // Each record is a sub‑document for a single student
    records: [
      {
        student: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Student",
          required: true,
        },
        status: {
          type: String,
          enum: ["present", "absent", "excused"],
          required: true,
          default: "absent",
        },
        markedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Ensure one attendance document per course per day (unique combination)
attendanceSchema.index({ courseCode: 1, date: 1, lecturer: 1 }, { unique: true });

// Prevent duplicate student entries in the same attendance record
attendanceSchema.index({ "records.student": 1 });

// OverwriteModelError guard
const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

export default Attendance;