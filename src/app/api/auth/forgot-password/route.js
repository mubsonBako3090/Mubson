import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { forgotPasswordSchema } from "@/lib/validators/user";
import { sendPasswordResetEmail } from "@/lib/mailer";

export async function POST(request) {
  try {
    const body = await request.json();
    const { error, value } = forgotPasswordSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ email: value.email });

    // Always return a generic success message — don't reveal whether the email exists.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      await sendPasswordResetEmail(user, rawToken);
    }

    return NextResponse.json({
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Request failed." }, { status: 500 });
  }
}
