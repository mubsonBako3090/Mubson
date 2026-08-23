import mongoose from "mongoose";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";

/*
 * --------------------------------------------------
 * ITEM SCHEMA
 * --------------------------------------------------
 *
 * For a normal requisition:
 *   requestingCollegeId
 *   requestingFacultyId
 *   requestingDepartment
 * can remain empty.
 *
 * For a consolidated requisition:
 * each item identifies exactly which
 * organizational unit requested it.
 */
const ItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

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

/*
 * --------------------------------------------------
 * ATTACHMENT SCHEMA
 * --------------------------------------------------
 */
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

/*
 * --------------------------------------------------
 * COMMENT SCHEMA
 * --------------------------------------------------
 */
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

/*
 * --------------------------------------------------
 * APPROVAL CHAIN STEP
 * --------------------------------------------------
 *
 * type = "approval"
 *   The person must approve, return or reject.
 *
 * type = "processing"
 *   Informational processing stage.
 *   Procurement does NOT approve the requisition.
 */
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

    type: {
      type: String,
      enum: ["approval", "processing"],
      default: "approval",
    },
  },
  { _id: false }
);

/*
 * --------------------------------------------------
 * REQUISITION SCHEMA
 * --------------------------------------------------
 */
const RequisitionSchema = new mongoose.Schema(
  {
    /*
     * --------------------------------------------------
     * BASIC IDENTIFICATION
     * --------------------------------------------------
     */
    requisitionNumber: {
      type: String,
      unique: true,
      sparse: true,
    },

    /*
     * User who initiated the requisition.
     */
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
 */

isConsolidated: {
  type: Boolean,
  default: false,
},

sourceRequisitions: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Requisition",
  },
],

consolidatedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
},

consolidatedInto: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Requisition",
},

consolidatedAt: {
  type: Date,
},

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
     * --------------------------------------------------
     * ORGANIZATIONAL SNAPSHOT
     * --------------------------------------------------
     *
     * Normal requisition:
     *
     * College → Faculty → Department
     *
     * Consolidated requisition:
     * these fields are not required because
     * multiple organizational units may be involved.
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

    /*
     * --------------------------------------------------
     * REQUISITION DETAILS
     * --------------------------------------------------
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

    /*
     * --------------------------------------------------
     * ITEMS
     * --------------------------------------------------
     *
     * For consolidated requisitions, each item can
     * identify its requesting department.
     */
    items: {
      type: [ItemSchema],
      default: [],
    },

    estimatedCost: {
      type: Number,
      default: 0,
    },

    /*
     * --------------------------------------------------
     * ATTACHMENTS & COMMENTS
     * --------------------------------------------------
     */
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    comments: {
      type: [CommentSchema],
      default: [],
    },

    /*
     * --------------------------------------------------
     * MAIN REQUISITION STATUS
     * --------------------------------------------------
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
     * --------------------------------------------------
     * APPROVAL CHAIN
     * --------------------------------------------------
     *
     * Normal example:
     *
     * HOD → Dean → Provost → VC → Procurement
     *
     * Procurement is "processing", not "approval".
     */
    approvalChain: {
      type: [ApprovalChainStepSchema],
      default: [],
    },

    /*
     * --------------------------------------------------
     * CURRENT STEP
     * --------------------------------------------------
     *
     * Identifies the current stage of the workflow.
     *
     * After VC approval this points to Procurement.
     */
    currentStepIndex: {
      type: Number,
      default: 0,
    },

    /*
     * --------------------------------------------------
     * REQUESTER ACTION
     * --------------------------------------------------
     *
     * true when the requisition has been returned
     * and the requester must edit/resubmit it.
     */
    awaitingRequesterAction: {
      type: Boolean,
      default: false,
    },

    /*
     * --------------------------------------------------
     * ESCALATION
     * --------------------------------------------------
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
     * After VC approval:
     *
     * ready
     *   ↓
     * processing
     *   ↓
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
     * Procurement staff member assigned to
     * process the requisition.
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

    /*
     * --------------------------------------------------
     * TIMESTAMPS
     * --------------------------------------------------
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

/*
 * --------------------------------------------------
 * MODEL EXPORT
 * --------------------------------------------------
 *
 * Prevents OverwriteModelError during Next.js
 * development hot reloads.
 */
export default mongoose.models.Requisition ||
  mongoose.model(
    "Requisition",
    RequisitionSchema
  );
