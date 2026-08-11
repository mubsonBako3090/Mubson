import mongoose from "mongoose";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";

const ItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },

    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },

    publicId: {
      type: String,
      required: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    fileType: {
      type: String,
      required: true,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const CommentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ApprovalChainStepSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
    },

    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // approval = must approve
    // processing = informational/processing stage after final approval
    type: {
      type: String,
      enum: ["approval", "processing"],
      default: "approval",
    },
  },
  { _id: false }
);

const RequisitionSchema = new mongoose.Schema(
  {
    requisitionNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Snapshot of the user's role when the requisition was created.
    // This is important because routing depends on who created the request.
    requesterRole: {
      type: String,
      required: true,
    },

    // Organizational snapshot at the time of submission.
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

    category: {
      type: String,
    },

    purpose: {
      type: String,
    },

    urgency: {
      type: String,
    },

    items: {
      type: [ItemSchema],
      default: [],
    },

    estimatedCost: {
      type: Number,
      default: 0,
    },

    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    comments: {
      type: [CommentSchema],
      default: [],
    },

    status: {
      type: String,
      enum: Object.values(REQUISITION_STATUS),
      default: REQUISITION_STATUS.DRAFT,
    },

    /*
     * Example:
     *
     * Requester:
     * HOD -> Dean -> Provost -> VC -> Procurement
     *
     * Provost:
     * VC -> Procurement
     *
     * VC:
     * Procurement
     *
     * Procurement:
     * VC -> Procurement
     */
    approvalChain: {
      type: [ApprovalChainStepSchema],
      default: [],
    },

    currentStepIndex: {
      type: Number,
      default: 0,
    },

    /*
     * True when the requisition is waiting for the requester
     * to edit and resubmit.
     */
    awaitingRequesterAction: {
      type: Boolean,
      default: false,
    },

    /*
     * True when the requisition exceeds the configured
     * escalation threshold.
     */
    requiresGovernorApproval: {
      type: Boolean,
      default: false,
    },

    /*
     * Indicates that VC has completed the final approval.
     * Procurement can now commence processing.
     */
    finalApprovalAt: {
      type: Date,
    },

    /*
     * Indicates when the Procurement Officer took ownership
     * of the post-approval processing stage.
     */
    procurementReceivedAt: {
  type: Date,
},

/*
 * Procurement processing status.
 *
 * This starts as "ready" when VC gives final approval
 * and the requisition reaches the Procurement Officer.
 */
procurementStatus: {
  type: String,
  enum: ["ready", "processing", "completed"],
  default: "ready",
},

/*
 * Procurement Officer responsible for processing
 * the approved requisition.
 */
procurementOfficer: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
},
    submittedAt: {
      type: Date,
    },

    decidedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Requisition ||
  mongoose.model("Requisition", RequisitionSchema);
