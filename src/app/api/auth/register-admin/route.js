import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import { registerAdminSchema } from "@/lib/validators/user";
import { hashPassword } from "@/lib/auth";
import { ROLES } from "@/constants/roles";

const ADMIN_CAP = 2;

// GET: tells the frontend whether admin registration is still open.
export async function GET() {
  await connectDB();
  const adminCount = await User.countDocuments({ isSystemAdmin: true });
  return NextResponse.json({ open: adminCount < ADMIN_CAP, adminCount, cap: ADMIN_CAP });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { error, value } = registerAdminSchema.validate(body);
    if (error) {
      return NextResponse.json({ message: error.details[0].message }, { status: 400 });
    }

    await connectDB();

    const adminCount = await User.countDocuments({ isSystemAdmin: true });
    if (adminCount >= ADMIN_CAP) {
      return NextResponse.json(
        { message: "Admin registration is closed — the maximum of 2 administrators has been reached." },
        { status: 403 }
      );
    }

    const existing = await User.findOne({ email: value.email });
    if (existing) {
      return NextResponse.json({ message: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(value.password);

    const admin = await User.create({
      fullName: value.fullName,
      email: value.email,
      passwordHash,
      role: ROLES.ADMIN,
      isSystemAdmin: true,
      accountStatus: "active", // admins are active immediately, no approval loop for themselves
      // Admin accounts aren't tied to a college/faculty/department in the
      // same functional sense, but the schema requires these fields —
      // use a neutral placeholder.
      collegeId: "administration",
      facultyId: "administration",
      department: "Administration",
    });

    await AuditLog.create({
      actor: admin._id,
      action: "user.register_admin",
      entityType: "User",
      entityId: admin._id,
    });

    return NextResponse.json({ message: "Administrator account created." }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Admin registration failed." }, { status: 500 });
  }
}
