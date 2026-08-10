import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import { resetPasswordSchema } from "@/lib/validators/user";
import { hashPassword } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const { error, value } = resetPasswordSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const hashedToken = crypto.createHash("sha256").update(value.token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return NextResponse.json({ message: "Reset link is invalid or has expired." }, { status: 400 });
    }

    user.passwordHash = await hashPassword(value.password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await AuditLog.create({
      actor: user._id,
      action: "user.password_reset",
      entityType: "User",
      entityId: user._id,
    });

    return NextResponse.json({ message: "Password has been reset. You can now log in." });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Reset failed." }, { status: 500 });
  }
}
