import mongoose from "mongoose";
import { ALL_ROLES } from "@/constants/roles";

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    role: { type: String, enum: ALL_ROLES, required: true },

    // Organizational placement — every user is tied to this for routing.
    collegeId: { type: String, required: true },
    facultyId: { type: String, required: true },
    department: { type: String, required: true },

    // Self-registered users start "pending" until an admin approves them.
    // Admin-invited users start "active" directly.
    accountStatus: {
      type: String,
      enum: ["pending", "active", "deactivated"],
      default: "pending",
    },

    // True only for the 2 hard-capped system administrator accounts.
    isSystemAdmin: { type: Boolean, default: false },

    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },

    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
