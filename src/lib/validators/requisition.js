import Joi from "joi";
import { REQUISITION_CATEGORIES, URGENCY_LEVELS } from "@/constants/requisitionOptions";

const urgencyValues = URGENCY_LEVELS.map((u) => u.value);

// `.unknown(true)` because items read back from MongoDB always include the
// computed `totalCost` field (set by requisitionService when the draft was
// saved) — without this, every submit attempt fails validation since Joi
// rejects unrecognized keys by default.
const itemSchema = Joi.object({
  name: Joi.string().required(),
  quantity: Joi.number().min(1).required(),
  unitCost: Joi.number().min(0).required(),
}).unknown(true);

// Draft: everything optional, so partial progress through the wizard can be saved.
export const draftRequisitionSchema = Joi.object({
  category: Joi.string()
    .valid(...REQUISITION_CATEGORIES)
    .allow(null, ""),
  purpose: Joi.string().allow(null, ""),
  urgency: Joi.string()
    .valid(...urgencyValues)
    .allow(null, ""),
  items: Joi.array().items(
    Joi.object({
      name: Joi.string().allow(""),
      quantity: Joi.number().min(0).allow(null),
      unitCost: Joi.number().min(0).allow(null),
    })
  ),
});

// Submit: full validation, must be complete before entering the approval chain.
export const submitRequisitionSchema = Joi.object({
  category: Joi.string()
    .valid(...REQUISITION_CATEGORIES)
    .required(),
  purpose: Joi.string().min(10).required(),
  urgency: Joi.string()
    .valid(...urgencyValues)
    .required(),
  items: Joi.array().items(itemSchema).min(1).required(),
});

export const approvalActionSchema = Joi.object({
  comment: Joi.string().allow(null, ""),
});

export const rejectActionSchema = Joi.object({
  comment: Joi.string().min(3).required(),
  isFinal: Joi.boolean().required(), // true = final rejection, false = requester may edit & resubmit
});
