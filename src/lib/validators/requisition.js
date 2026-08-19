import Joi from "joi";
import {
  REQUISITION_CATEGORIES,
  URGENCY_LEVELS,
} from "@/constants/requisitionOptions";

const urgencyValues = URGENCY_LEVELS.map(
  (u) => u.value
);

/*
 * Item validation used when submitting
 * a completed requisition.
 *
 * totalCost is included because items saved
 * in MongoDB already contain the calculated
 * totalCost value.
 */
const itemSchema = Joi.object({
  name: Joi.string().required(),

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

/*
 * Item validation used while saving a draft.
 *
 * Drafts can be incomplete, so all fields are
 * optional. totalCost is also accepted because
 * it may already exist on an item loaded from
 * MongoDB.
 */
const draftItemSchema = Joi.object({
  name: Joi.string().allow(""),

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

// Draft: everything optional, allowing partial
// progress through the requisition wizard.
export const draftRequisitionSchema =
  Joi.object({
    category: Joi.string()
      .valid(...REQUISITION_CATEGORIES)
      .allow(null, ""),

    purpose: Joi.string()
      .allow(null, ""),

    urgency: Joi.string()
      .valid(...urgencyValues)
      .allow(null, ""),

    items: Joi.array().items(
      draftItemSchema
    ),
  });

// Submit: full validation. A requisition must
// be complete before entering the approval chain.
export const submitRequisitionSchema =
  Joi.object({
    category: Joi.string()
      .valid(...REQUISITION_CATEGORIES)
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
  });

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
