import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import { loginSchema } from "@/lib/validators/user";
import { verifyPassword, signToken } from "@/lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const { error, value } = loginSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ email: value.email });
    if (!user) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    const passwordOk = await verifyPassword(value.password, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    if (user.accountStatus === "pending") {
      return NextResponse.json({ message: "Your account is awaiting admin approval." }, { status: 403 });
    }
    if (user.accountStatus === "deactivated") {
      return NextResponse.json({ message: "Your account has been deactivated. Contact an administrator." }, { status: 403 });
    }

    const token = signToken(user);

    user.lastLoginAt = new Date();
    await user.save();

    await AuditLog.create({
      actor: user._id,
      action: "login",
      entityType: "User",
      entityId: user._id,
    });

    const response = NextResponse.json({
      message: "Login successful.",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        collegeId: user.collegeId,
        facultyId: user.facultyId,
        department: user.department,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Login failed." }, { status: 500 });
  }
}
