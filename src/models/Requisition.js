import mongoose from "mongoose";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";

const ItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    /*
     * For normal requisitions, this can remain empty.
     *
     * For consolidated requisitions, this identifies
     * exactly which department needs this item.
     */
    requestingCollegeId: {
      type: String,
    },

    requestingFacultyId: {
      type: String,
    },

    requestingDepartment: {
      type: String,
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

    /*
     * approval:
     *   The person must approve/reject/return.
     *
     * processing:
     *   Informational processing stage.
     *   Procurement does NOT approve the requisition.
     */
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

    /*
     * Role of the user who created the requisition.
     */
    requesterRole: {
      type: String,
      required: true,
    },

        /*
     * --------------------------------------------------
     * CONSOLIDATED REQUISITION
     * --------------------------------------------------
     *
     * false:
     *   Normal requisition.
     *
     * true:
     *   This requisition combines requirements from
     *   multiple existing requisitions/organizational
     *   units.
     */
    isConsolidated: {
      type: Boolean,
      default: false,
    },

    /*
     * Requisitions that were combined to create this
     * consolidated requisition.
     *
     * Example:
     *
     * [
     *   requisitionA,
     *   requisitionB,
     *   requisitionC
     * ]
     */
    sourceRequisitions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Requisition",
      },
    ],

    /*
     * User who created the consolidated requisition.
     *
     * Usually:
     * Dean
     * Provost
     * VC
     * Procurement
     */
    consolidatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /*
     * Organizational units represented in the
     * consolidated requisition.
     *
     * These are snapshots so that future changes to
     * users/departments do not change historical records.
     */
    requestingUnits: [
      {
        collegeId: {
          type: String,
          required: true,
        },

        facultyId: {
          type: String,
        },

        department: {
          type: String,
        },
      },
    ],

    /*
     * Organisational snapshot.
     */
        collegeId: {
      type: String,
      required: function () {
        return !this.isConsolidated;
      },
    },

    facultyId: {
      type: String,
      required: function () {
        return !this.isConsolidated;
      },
    },

    department: {
      type: String,
      required: function () {
        return !this.isConsolidated;
      },
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

    /*
     * Main requisition lifecycle.
     *
     * draft
     * pending
     * returned
     * approved
     * rejected
     */
    status: {
      type: String,
      enum: Object.values(REQUISITION_STATUS),
      default: REQUISITION_STATUS.DRAFT,
    },

    /*
     * Approval chain.
     *
     * Example:
     *
     * HOD -> Dean -> Provost -> VC -> Procurement
     *
     * Procurement is type "processing", not "approval".
     */
    approvalChain: {
      type: [ApprovalChainStepSchema],
      default: [],
    },

    /*
     * Index of the currently visible stage.
     *
     * After VC approval this points to Procurement.
     */
    currentStepIndex: {
      type: Number,
      default: 0,
    },

    /*
     * True when requester must edit/resubmit.
     */
    awaitingRequesterAction: {
      type: Boolean,
      default: false,
    },

    /*
     * True when estimated cost exceeds escalation threshold.
     */
    requiresGovernorApproval: {
      type: Boolean,
      default: false,
    },

    /*
     * --------------------------------------------------
     * FINAL APPROVAL
     * --------------------------------------------------
     *
     * Set when VC gives final approval.
     */
    finalApprovalAt: {
      type: Date,
    },

    /*
     * --------------------------------------------------
     * PROCUREMENT PROCESSING
     * --------------------------------------------------
     *
     * Procurement does NOT approve the requisition.
     *
     * It receives the requisition after VC approval.
     *
     * Values:
     *
     * ready
     * processing
     * completed
     */
    procurementStatus: {
      type: String,
      enum: [
        "ready",
        "processing",
        "completed",
      ],
      default: undefined,
    },

    /*
     * Procurement Officer assigned to process
     * this requisition.
     */
    procurementOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /*
     * When Procurement received the requisition.
     */
    procurementReceivedAt: {
      type: Date,
    },

    /*
     * When Procurement started processing.
     */
    procurementStartedAt: {
      type: Date,
    },

    /*
     * When Procurement completed processing.
     */
    procurementCompletedAt: {
      type: Date,
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
  mongoose.model(
    "Requisition",
    RequisitionSchema
  );
