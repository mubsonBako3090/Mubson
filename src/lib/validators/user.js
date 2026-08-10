import Joi from "joi";
import { SELF_REGISTERABLE_ROLES } from "@/constants/roles";

export const registerSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string()
    .valid(...SELF_REGISTERABLE_ROLES)
    .required(),
  collegeId: Joi.string().required(),
  facultyId: Joi.string().required(),
  department: Joi.string().required(),
});

export const registerAdminSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

export const inviteUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  role: Joi.string().required(),
  collegeId: Joi.string().required(),
  facultyId: Joi.string().required(),
  department: Joi.string().required(),
});

export const editUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(100),
  role: Joi.string(),
  collegeId: Joi.string(),
  facultyId: Joi.string(),
  department: Joi.string(),
  accountStatus: Joi.string().valid("pending", "active", "deactivated"),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

export const updateOwnProfileSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).required(),
});
