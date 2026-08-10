import mongoose from "mongoose";

// Logs every status change, login, and edit across the system.
const AuditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // null for system-generated events
    action: { type: String, required: true }, // e.g. "login", "requisition.submit", "requisition.approve", "user.edit"
    entityType: { type: String }, // "User" | "Requisition" | "Approval"
    entityId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed }, // free-form: before/after, comment, ip, etc.
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
