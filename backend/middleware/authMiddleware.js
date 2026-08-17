import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";

// USER ONLY
export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  const headerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  const cookieToken = req.cookies?.jwt || null;

  const tokensToTry = [headerToken, cookieToken].filter(Boolean);

  console.log("AUTH HEADER:", authHeader);
  console.log("COOKIES:", req.cookies);

  if (!tokensToTry.length) {
    res.status(401);
    throw new Error("Not authorized, no user token");
  }

  for (const token of tokensToTry) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId || decoded.id;
      const user = await User.findById(userId).select("-password");

      if (user) {
        req.user = user;
        return next();
      }
    } catch (err) {
      console.log("TOKEN FAILED:", err.message);
    }
  }

  res.status(401);
  throw new Error("Not authorized, user token failed");
});