import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export async function sendRegistrationPendingEmail(user) {
  return sendMail({
    to: user.email,
    subject: "KSU Procurement — Registration Received",
    html: `<p>Hi ${user.fullName},</p><p>Your account has been created and is awaiting admin approval. You'll receive an email once it's approved.</p>`,
  });
}

export async function sendAccountApprovedEmail(user) {
  return sendMail({
    to: user.email,
    subject: "KSU Procurement — Account Approved",
    html: `<p>Hi ${user.fullName},</p><p>Your account has been approved. You can now log in to the KSU Procurement Requisition System.</p>`,
  });
}

export async function sendPasswordResetEmail(user, resetToken) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${resetToken}`;
  return sendMail({
    to: user.email,
    subject: "KSU Procurement — Password Reset",
    html: `<p>Hi ${user.fullName},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });
}

export async function sendRequisitionSubmittedEmail(user, requisition) {
  return sendMail({
    to: user.email,
    subject: `Requisition ${requisition.requisitionNumber} Submitted`,
    html: `<p>Hi ${user.fullName},</p><p>Your requisition <strong>${requisition.requisitionNumber}</strong> has been submitted and is now awaiting approval.</p>`,
  });
}

export async function sendApprovalStepEmail(approver, requisition) {
  return sendMail({
    to: approver.email,
    subject: `Requisition ${requisition.requisitionNumber} Awaiting Your Approval`,
    html: `<p>Hi ${approver.fullName},</p><p>Requisition <strong>${requisition.requisitionNumber}</strong> is awaiting your review.</p>`,
  });
}

export async function sendRequisitionApprovedEmail(user, requisition) {
  return sendMail({
    to: user.email,
    subject: `Requisition ${requisition.requisitionNumber} Approved`,
    html: `<p>Hi ${user.fullName},</p><p>Your requisition <strong>${requisition.requisitionNumber}</strong> has been fully approved.</p>`,
  });
}

export async function sendRequisitionRejectedEmail(user, requisition, comment) {
  return sendMail({
    to: user.email,
    subject: `Requisition ${requisition.requisitionNumber} Rejected`,
    html: `<p>Hi ${user.fullName},</p><p>Your requisition <strong>${requisition.requisitionNumber}</strong> was rejected.</p><p>Reason: ${comment || "No comment provided."}</p>`,
  });
}

export async function sendRequisitionReturnedEmail(user, requisition, comment) {
  return sendMail({
    to: user.email,
    subject: `Requisition ${requisition.requisitionNumber} Returned for Clarification`,
    html: `<p>Hi ${user.fullName},</p><p>Your requisition <strong>${requisition.requisitionNumber}</strong> was returned for clarification.</p><p>Comment: ${comment || "No comment provided."}</p>`,
  });
}
