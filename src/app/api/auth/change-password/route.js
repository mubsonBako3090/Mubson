import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, verifyPassword, hashPassword } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import { changePasswordSchema } from "@/lib/validators/user";

function getAuth() {
  const token = cookies().get("token")?.value;
  return token ? verifyToken(token) : null;
}

export async function POST(request) {
  const auth = getAuth();
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { error, value } = changePasswordSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(auth.sub);
    if (!user) return NextResponse.json({ message: "User not found." }, { status: 404 });

    const currentOk = await verifyPassword(value.currentPassword, user.passwordHash);
    if (!currentOk) {
      return NextResponse.json({ message: "Current password is incorrect." }, { status: 400 });
    }

    user.passwordHash = await hashPassword(value.newPassword);
    await user.save();

    await AuditLog.create({
      actor: user._id,
      action: "user.password_change",
      entityType: "User",
      entityId: user._id,
    });

    return NextResponse.json({ message: "Password updated." });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Password change failed." }, { status: 500 });
  }
}
