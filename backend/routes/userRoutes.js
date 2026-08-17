import express from "express";
import {
  registerLecturer,
  loginLecturer,
  verifyOTP,
  forgotPassword,
  resetPassword,
  getLecturerInfo,
  logoutLecturer,
  updateProfile,
  toggleTwoFactor,
  getAllLecturers,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "AttendanceSystemLecturerProfiles", // changed from CampusResolveProfiles
    allowed_formats: ["jpg", "png", "jpeg"],
    transformation: [{ width: 300, height: 300, crop: "fill" }],
  },
});
const upload = multer({ storage });

// Public routes
router.post("/register", registerLecturer);
router.post("/login", loginLecturer);
router.post("/verify-otp", verifyOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Private routes (require authentication)
router.use(protect); // All routes below this line require a valid token

// Get all lecturers (admin only)
router.get("/", getAllLecturers);

router.get("/me", getLecturerInfo);
router.post("/logout", logoutLecturer);
router.put("/update", upload.single("profilePicture"), updateProfile);
router.put("/toggle-2fa", toggleTwoFactor);

export default router;