import mongoose from "mongoose";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";

const ItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    // Computed at save time: quantity * unitCost
    totalCost: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true }, // Cloudinary public_id, for deletion
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CommentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const RequisitionSchema = new mongoose.Schema(
  {
    requisitionNumber: { type: String, unique: true, sparse: true }, // assigned on submit, not on draft

    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Snapshot of requester's org placement at time of submission (routing depends on this).
    collegeId: { type: String, required: true },
    facultyId: { type: String, required: true },
    department: { type: String, required: true },

    category: { type: String },
    purpose: { type: String },
    urgency: { type: String },

    items: { type: [ItemSchema], default: [] },
    estimatedCost: { type: Number, default: 0 }, // sum of items[].totalCost

    attachments: { type: [AttachmentSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },

    status: {
      type: String,
      enum: Object.values(REQUISITION_STATUS),
      default: REQUISITION_STATUS.DRAFT,
    },

    // Ordered list of role-steps this requisition must pass through, computed at submit time
    // from lib/routing.js based on the requester's college/faculty/department and estimatedCost.
    approvalChain: [
      {
        role: { type: String, required: true },
        approver: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // resolved user for that step, if known
      },
    ],
    currentStepIndex: { type: Number, default: 0 },

    // True when a "returned" requisition is waiting on the requester to edit
    // and resubmit (e.g. the first-step approver returned it, or an approver
    // rejected without finality). False when it's a step-to-previous-approver
    // return, meaning the previous approver needs to act again, not the requester.
    awaitingRequesterAction: { type: Boolean, default: false },

    // Whether this requisition crossed the escalation threshold and needs Governor sign-off.
    requiresGovernorApproval: { type: Boolean, default: false },

    submittedAt: { type: Date },
    decidedAt: { type: Date }, // set when finally approved or finally rejected
  },
  { timestamps: true }
);

export default mongoose.models.Requisition || mongoose.model("Requisition", RequisitionSchema);
