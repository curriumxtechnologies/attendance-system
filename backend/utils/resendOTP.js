import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTP = async (email, otp, purpose) => {
  const subject =
    purpose === "email-verification"
      ? "Verify your email"
      : purpose === "login-2fa"
      ? "Your login OTP"
      : "Password reset OTP";

  const html = `
    <h2>Attendance System</h2>
    <p>Your OTP for <strong>${subject}</strong> is:</p>
    <h1 style="letter-spacing:4px;">${otp}</h1>
    <p>This OTP expires in 5 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: "Attendance System <attendance@curriumx.online>",   // ⚠️ replace with your verified domain and email
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error("Failed to send OTP email");
    }

    return data;
  } catch (err) {
    console.error("Send OTP error:", err.message);
    throw new Error("Could not send OTP");
  }
};

export default sendOTP;