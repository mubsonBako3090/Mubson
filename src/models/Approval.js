import mongoose from "mongoose";
import { APPROVAL_ACTIONS } from "@/constants/requisitionOptions";

// One record per decision made on a requisition at a given step.
// A returned-for-clarification loop produces multiple Approval records
// against the same requisition + step as it goes back and forth.
const ApprovalSchema = new mongoose.Schema(
  {
    requisition: { type: mongoose.Schema.Types.ObjectId, ref: "Requisition", required: true },
    stepIndex: { type: Number, required: true },
    role: { type: String, required: true }, // role this step represents (hod, dean, provost, vc, ...)

    approver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: Object.values(APPROVAL_ACTIONS), required: true },
    comment: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Approval || mongoose.model("Approval", ApprovalSchema);
