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

const RequisitionSchema = new mongoose.Schema(
  {
    /*
    |--------------------------------------------------------------------------
    | Requisition Number
    |--------------------------------------------------------------------------
    */

    requisitionNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Requester
    |--------------------------------------------------------------------------
    */

    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    requesterRole: {
      type: String,
      required: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Organizational placement snapshot
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
    | Requisition details
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Overall status
    |--------------------------------------------------------------------------
    */

    status: {
      type: String,
      enum: Object.values(REQUISITION_STATUS),
      default: REQUISITION_STATUS.DRAFT,
    },

    /*
    |--------------------------------------------------------------------------
    | Approval chain
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    | Procurement Officer is NOT stored here.
    |
    | approvalChain contains ONLY actual approval authorities.
    |
    */

    approvalChain: [
      {
        role: {
          type: String,
          required: true,
        },

        approver: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    currentStepIndex: {
      type: Number,
      default: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | Requester action
    |--------------------------------------------------------------------------
    */

    awaitingRequesterAction: {
      type: Boolean,
      default: false,
    },

    /*
    |--------------------------------------------------------------------------
    | Governor escalation
    |--------------------------------------------------------------------------
    */

    requiresGovernorApproval: {
      type: Boolean,
      default: false,
    },

    /*
    |--------------------------------------------------------------------------
    | Procurement Processing
    |--------------------------------------------------------------------------
    |
    | Procurement is NOT an approval step.
    |
    | Once the final approval authority (normally VC)
    | approves the requisition, procurementStatus becomes
    | "received".
    |
    */

    procurementStatus: {
      type: String,

      enum: [
        "not_received",
        "received",
        "processing",
        "completed",
      ],

      default: "not_received",
    },

    procurementOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    procurementReceivedAt: {
      type: Date,
    },

    procurementStartedAt: {
      type: Date,
    },

    procurementCompletedAt: {
      type: Date,
    },

    /*
    |--------------------------------------------------------------------------
    | Dates
    |--------------------------------------------------------------------------
    */

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
