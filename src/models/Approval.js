import mongoose from "mongoose";
import {
  APPROVAL_ACTIONS,
} from "@/constants/requisitionOptions";

/*
 * Stores actual approval decisions.
 *
 * Procurement processing is NOT stored as an approval
 * because Procurement does not approve the requisition
 * after VC approval.
 */
const ApprovalSchema =
  new mongoose.Schema(
    {
      requisition: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Requisition",
        required: true,
      },

      stepIndex: {
        type: Number,
        required: true,
      },

      role: {
        type: String,
        required: true,
      },

      approver: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      action: {
        type: String,
        enum:
          Object.values(
            APPROVAL_ACTIONS
          ),
        required: true,
      },

      comment: {
        type: String,
      },
    },
    {
      timestamps: true,
    }
  );

export default mongoose.models.Approval ||
  mongoose.model(
    "Approval",
    ApprovalSchema
  );
