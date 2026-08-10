import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import { registerSchema } from "@/lib/validators/user";
import { hashPassword } from "@/lib/auth";
import { sendRegistrationPendingEmail } from "@/lib/mailer";

export async function POST(request) {
  try {
    const body = await request.json();
    const { error, value } = registerSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ email: value.email });
    if (existing) {
      return NextResponse.json({ message: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(value.password);

    const user = await User.create({
      fullName: value.fullName,
      email: value.email,
      passwordHash,
      role: value.role,
      collegeId: value.collegeId,
      facultyId: value.facultyId,
      department: value.department,
      accountStatus: "pending",
    });

    await AuditLog.create({
      actor: user._id,
      action: "user.self_register",
      entityType: "User",
      entityId: user._id,
      details: { role: user.role },
    });

    await sendRegistrationPendingEmail(user);

    return NextResponse.json(
      { message: "Registration submitted. Await admin approval before logging in." },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Registration failed." }, { status: 500 });
  }
}
