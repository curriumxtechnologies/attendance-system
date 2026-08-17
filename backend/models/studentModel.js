import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const courseSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const studentSchema = new Schema(
  {
    matricNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: Number,
      required: true,
      enum: [100, 200, 300, 400, 500],
    },
    department: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "Computer Science",
        "International Relations",
        "Nursing Science",
        "Peace and Conflict Studies",
        "Micro Biology",
        "Science Laboratory Technology",
        "Software Engineering",
        "Mass Communication",
        "Accounting",
        "Biochemistry",
      ],
    },
    courses: {
      type: [courseSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Helpful compound index for common queries (e.g. list students per department/level)
studentSchema.index({ department: 1, level: 1 });

// Prevent OverwriteModelError on hot reloads / repeated imports
const Student = models.Student || model("Student", studentSchema);

export default Student;