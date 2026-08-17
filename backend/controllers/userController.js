import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";          // ✅ your unified User model
import generateToken from "../utils/generateToken.js";
import sendOTP from "../utils/resendOTP.js";
import jwt from "jsonwebtoken";

// @desc    Register a new lecturer
// @route   POST /api/lecturers/register
// @access  Public
const registerLecturer = asyncHandler(async (req, res) => {
  const { fullName, staffId, email, courses, password } = req.body;

  if (!fullName || !staffId || !email || !courses || !password) {
    res.status(400);
    throw new Error("Please fill all fields (fullName, staffId, email, courses, password)");
  }

  // Ensure courses is an array
  const courseArray = Array.isArray(courses) ? courses : [courses];

  // Check if a lecturer with this staffId or email already exists
  const existingUser = await User.findOne({
    role: "lecturer",
    $or: [{ staffId }, { email: email.toLowerCase() }],
  });

  if (existingUser) {
    res.status(400);
    throw new Error("Lecturer already registered with this staff ID or email");
  }

  // Create the lecturer (role explicitly set)
  const user = await User.create({
    fullName,
    staffId,
    email: email.toLowerCase(),
    courses: courseArray,
    password,
    role: "lecturer",
  });

  // Send OTP for email verification
  const otp = user.generateOTP();
  await user.save();
  await sendOTP(user.email, otp, "email-verification");

  res.status(201).json({
    success: true,
    message: "Registration successful. OTP sent to your email for verification.",
    lecturerId: user._id,
  });
});

// @desc    Login lecturer
// @route   POST /api/lecturers/login
// @access  Public
const loginLecturer = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    res.status(400);
    throw new Error("Staff ID or Email and password required");
  }

  // Find a user with role 'lecturer' matching identifier (staffId or email)
  const user = await User.findOne({
    role: "lecturer",
    $or: [{ staffId: identifier }, { email: identifier.toLowerCase() }],
  });

  if (!user) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  if (user.twoFactorEnabled) {
    // 2FA enabled – send OTP and return a short-lived token
    const otp = user.generateOTP();
    await user.save();
    await sendOTP(user.email, otp, "login-2fa");

    const tempToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "5m" });

    res.status(200).json({
      success: true,
      message: "OTP sent to your email for two-factor authentication",
      tempToken,
      lecturerId: user._id,
    });
  } else {
    // No 2FA – login immediately
    const token = generateToken(res, user._id);
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      lecturer: {
        _id: user._id,
        fullName: user.fullName,
        staffId: user.staffId,
        email: user.email,
        courses: user.courses || [],
        profilePicture: user.profilePicture || "",
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  }
});

// @desc    Verify OTP for various purposes
// @route   POST /api/lecturers/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp, purpose, tempToken } = req.body;

  if (!otp || !purpose) {
    res.status(400);
    throw new Error("OTP and purpose are required");
  }

  let user;
  if (purpose === "email-verification" || purpose === "password-reset") {
    if (!email) {
      res.status(400);
      throw new Error("Email is required for this purpose");
    }
    user = await User.findOne({ email: email.toLowerCase(), role: "lecturer" });
  } else if (purpose === "login-2fa") {
    if (!tempToken) {
      res.status(400);
      throw new Error("Temporary token required for login OTP verification");
    }
    try {
      const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      user = await User.findById(decoded.userId);
      // Ensure the user is a lecturer
      if (user && user.role !== "lecturer") {
        res.status(403);
        throw new Error("Access denied: not a lecturer");
      }
    } catch (error) {
      res.status(401);
      throw new Error("Invalid or expired temporary token");
    }
  } else {
    res.status(400);
    throw new Error("Invalid purpose");
  }

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Check OTP validity
  if (!user.otp || !user.otpExpires || user.otp !== otp || user.otpExpires < Date.now()) {
    res.status(400);
    throw new Error("Invalid or expired OTP");
  }

  // OTP is correct – proceed based on purpose
  if (purpose === "email-verification") {
    user.isVerified = true;
    user.clearOTP();
    await user.save();
    res.status(200).json({ success: true, message: "Email verified successfully" });
  } else if (purpose === "login-2fa") {
    const token = generateToken(res, user._id);
    user.clearOTP();
    await user.save();
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      lecturer: {
        _id: user._id,
        fullName: user.fullName,
        staffId: user.staffId,
        email: user.email,
        courses: user.courses || [],
        profilePicture: user.profilePicture || "",
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } else if (purpose === "password-reset") {
    const resetToken = jwt.sign(
      { userId: user._id, purpose: "reset-password" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );
    user.clearOTP();
    await user.save();
    res.status(200).json({
      success: true,
      message: "OTP verified. Use the reset token to set a new password.",
      resetToken,
    });
  }
});

// @desc    Forgot password – send OTP
// @route   POST /api/lecturers/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const user = await User.findOne({ email: email.toLowerCase(), role: "lecturer" });
  if (!user) {
    // Prevent email enumeration
    return res.status(200).json({ success: true, message: "If the email exists, an OTP has been sent." });
  }

  const otp = user.generateOTP();
  await user.save();
  await sendOTP(user.email, otp, "password-reset");

  res.status(200).json({
    success: true,
    message: "OTP sent to your email for password reset",
  });
});

// @desc    Reset password (using resetToken from verify-otp)
// @route   POST /api/lecturers/reset-password
// @access  Private (with resetToken)
const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    res.status(400);
    throw new Error("Reset token and new password are required");
  }

  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (decoded.purpose !== "reset-password") {
      res.status(400);
      throw new Error("Invalid reset token purpose");
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.role !== "lecturer") {
      res.status(404);
      throw new Error("Lecturer not found");
    }

    user.password = newPassword;
    user.clearOTP();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful. You can now login.",
    });
  } catch (error) {
    res.status(401);
    throw new Error("Invalid or expired reset token");
  }
});

// @desc    Get current lecturer info
// @route   GET /api/lecturers/me
// @access  Private
const getLecturerInfo = asyncHandler(async (req, res) => {
  // req.user is set by the protect middleware
  const user = await User.findById(req.user._id)
    .select("-password -otp -otpExpires");
  if (!user || user.role !== "lecturer") {
    res.status(404);
    throw new Error("Lecturer not found");
  }
  res.status(200).json({ success: true, lecturer: user });
});

// @desc    Logout (optional, stateless)
// @route   POST /api/lecturers/logout
// @access  Private
const logoutLecturer = asyncHandler(async (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

// @desc    Update profile (picture, password, or courses)
// @route   PUT /api/lecturers/update
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user || user.role !== "lecturer") {
    res.status(404);
    throw new Error("Lecturer not found");
  }

  const { password, courses } = req.body;

  // At least one field to update
  if (!req.file && !password && !courses) {
    res.status(400);
    throw new Error("Provide profile image, password, or courses to update");
  }

  if (req.file) {
    user.profilePicture = req.file.path || req.file.secure_url || "";
  }

  if (password) {
    user.password = password; // hashed by pre-save hook
  }

  if (courses) {
    user.courses = Array.isArray(courses) ? courses : [courses];
  }

  const updated = await user.save();

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    lecturer: {
      _id: updated._id,
      fullName: updated.fullName,
      staffId: updated.staffId,
      email: updated.email,
      courses: updated.courses || [],
      profilePicture: updated.profilePicture || "",
      role: updated.role,
      isVerified: updated.isVerified,
    },
  });
});

// @desc    Toggle two-factor authentication
// @route   PUT /api/lecturers/toggle-2fa
// @access  Private
const toggleTwoFactor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user || user.role !== "lecturer") {
    res.status(404);
    throw new Error("Lecturer not found");
  }

  user.twoFactorEnabled = !user.twoFactorEnabled;
  await user.save();

  res.status(200).json({
    success: true,
    message: `Two-factor authentication ${user.twoFactorEnabled ? "enabled" : "disabled"}.`,
    twoFactorEnabled: user.twoFactorEnabled,
  });
});

// @desc    Get all lecturers (admin only)
// @route   GET /api/lecturers
// @access  Private/Admin
const getAllLecturers = asyncHandler(async (req, res) => {
  // Only return users with role 'lecturer'
  const filter = { role: "lecturer" };
  // Optional additional filters (e.g., by department if you add it)
  if (req.query.department) filter.department = req.query.department;

  const lecturers = await User.find(filter)
    .select("-password -otp -otpExpires")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    lecturers,
  });
});

export {
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
};