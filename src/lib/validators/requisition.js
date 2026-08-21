import Joi from "joi";

import {
  REQUISITION_CATEGORIES,
  URGENCY_LEVELS,
} from "@/constants/requisitionOptions";

const urgencyValues =
  URGENCY_LEVELS.map(
    (u) => u.value
  );

/*
 * --------------------------------------------------
 * ITEM SCHEMAS
 * --------------------------------------------------
 */

const itemSchema =
  Joi.object({
    name: Joi.string()
      .required(),

    quantity: Joi.number()
      .min(1)
      .required(),

    unitCost: Joi.number()
      .min(0)
      .required(),

    totalCost: Joi.number()
      .min(0)
      .required(),
  });

const draftItemSchema =
  Joi.object({
    name: Joi.string()
      .allow(""),

    quantity: Joi.number()
      .min(0)
      .allow(null),

    unitCost: Joi.number()
      .min(0)
      .allow(null),

    totalCost: Joi.number()
      .min(0)
      .allow(null),
  });

/*
 * --------------------------------------------------
 * DRAFT
 * --------------------------------------------------
 *
 * Organizational fields are optional while
 * drafting because a user may save progress
 * before completing the first step.
 *
 * Procurement must complete them before
 * submission.
 */

export const draftRequisitionSchema =
  Joi.object({
    category: Joi.string()
      .valid(
        ...REQUISITION_CATEGORIES
      )
      .allow(null, ""),

    purpose: Joi.string()
      .allow(null, ""),

    urgency: Joi.string()
      .valid(...urgencyValues)
      .allow(null, ""),

    items: Joi.array()
      .items(draftItemSchema),

    /*
     * Procurement requesting organization.
     */
    collegeId: Joi.string()
      .allow(null, ""),

    facultyId: Joi.string()
      .allow(null, ""),

    department: Joi.string()
      .allow(null, ""),
  });

/*
 * --------------------------------------------------
 * SUBMISSION
 * --------------------------------------------------
 */

export const submitRequisitionSchema =
  Joi.object({
    category: Joi.string()
      .valid(
        ...REQUISITION_CATEGORIES
      )
      .required(),

    purpose: Joi.string()
      .min(10)
      .required(),

    urgency: Joi.string()
      .valid(...urgencyValues)
      .required(),

    items: Joi.array()
      .items(itemSchema)
      .min(1)
      .required(),

    /*
     * These are checked separately by the
     * requisition service according to role.
     */
    collegeId: Joi.string()
      .allow(null, ""),

    facultyId: Joi.string()
      .allow(null, ""),

    department: Joi.string()
      .allow(null, ""),
  });

/*
 * --------------------------------------------------
 * APPROVAL ACTIONS
 * --------------------------------------------------
 */

export const approvalActionSchema =
  Joi.object({
    comment: Joi.string()
      .allow(null, ""),
  });

export const rejectActionSchema =
  Joi.object({
    comment: Joi.string()
      .min(3)
      .required(),

    isFinal: Joi.boolean()
      .required(),
  });
