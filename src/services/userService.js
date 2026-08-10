import crypto from "crypto";
import User from "@/models/User";
import AuditLog from "@/models/AuditLog";
import { hashPassword } from "@/lib/auth";
import { sendAccountApprovedEmail, sendPasswordResetEmail } from "@/lib/mailer";

// Admin creates a user directly — active immediately, no approval step.
// A random temporary password is generated and the user is sent a password
// reset link (via the existing forgot-password email template) so they can
// set their own password on first login, since we don't have a seed/invite-email flow otherwise.
export async function inviteUser({ adminId, payload }) {
  const existing = await User.findOne({ email: payload.email });
  if (existing) throw new Error("An account with this email already exists.");

  const temporaryPassword = crypto.randomBytes(12).toString("hex");
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await User.create({
    fullName: payload.fullName,
    email: payload.email,
    passwordHash,
    role: payload.role,
    collegeId: payload.collegeId,
    facultyId: payload.facultyId,
    department: payload.department,
    accountStatus: "active",
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h to set password
  await user.save();

  await AuditLog.create({
    actor: adminId,
    action: "user.invite",
    entityType: "User",
    entityId: user._id,
    details: { role: user.role },
  });

  await sendPasswordResetEmail(user, rawToken);

  return user;
}

export async function approvePendingUser({ adminId, userId }) {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found.");
  if (user.accountStatus !== "pending") throw new Error("This account is not pending approval.");

  user.accountStatus = "active";
  await user.save();

  await AuditLog.create({
    actor: adminId,
    action: "user.approve",
    entityType: "User",
    entityId: user._id,
  });

  await sendAccountApprovedEmail(user);

  return user;
}

export async function editUser({ adminId, userId, payload }) {
  const before = await User.findById(userId).lean();
  if (!before) throw new Error("User not found.");

  const user = await User.findByIdAndUpdate(userId, { $set: payload }, { new: true });

  await AuditLog.create({
    actor: adminId,
    action: "user.edit",
    entityType: "User",
    entityId: user._id,
    details: { before, after: payload },
  });

  return user;
}

export async function setUserActiveStatus({ adminId, userId, accountStatus }) {
  const user = await User.findByIdAndUpdate(userId, { $set: { accountStatus } }, { new: true });
  if (!user) throw new Error("User not found.");

  await AuditLog.create({
    actor: adminId,
    action: accountStatus === "deactivated" ? "user.deactivate" : "user.reactivate",
    entityType: "User",
    entityId: user._id,
  });

  return user;
}
