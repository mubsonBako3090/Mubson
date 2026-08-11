import mongoose from "mongoose";
import { ALL_ROLES } from "@/constants/roles";

const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ALL_ROLES,
      required: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Organizational placement
    |--------------------------------------------------------------------------
    */

    collegeId: {
      type: String,
      required: true,
    },

    facultyId: {
      type: String,
      required: true,
    },

    department: {
      type: String,
      required: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Account status
    |--------------------------------------------------------------------------
    */

    accountStatus: {
      type: String,

      enum: [
        "pending",
        "active",
        "deactivated",
      ],

      default: "pending",
    },

    /*
    |--------------------------------------------------------------------------
    | System administrator
    |--------------------------------------------------------------------------
    */

    isSystemAdmin: {
      type: Boolean,
      default: false,
    },

    /*
    |--------------------------------------------------------------------------
    | Password reset
    |--------------------------------------------------------------------------
    */

    passwordResetToken: {
      type: String,
    },

    passwordResetExpires: {
      type: Date,
    },

    /*
    |--------------------------------------------------------------------------
    | Login
    |--------------------------------------------------------------------------
    */

    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.User ||
  mongoose.model(
    "User",
    UserSchema
  );
