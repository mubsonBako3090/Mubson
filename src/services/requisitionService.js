import Requisition from "@/models/Requisition";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";
import { buildApprovalChain, isEscalated } from "@/lib/routing";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";
import { sendRequisitionSubmittedEmail, sendApprovalStepEmail } from "@/lib/mailer";

function computeItemTotals(items = []) {
  return items.map((item) => ({
    ...item,
    totalCost: Number(item.quantity || 0) * Number(item.unitCost || 0),
  }));
}

function sumEstimatedCost(items = []) {
  return items.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
}

async function generateRequisitionNumber() {
  const year = new Date().getFullYear();
  const count = await Requisition.countDocuments({
    requisitionNumber: { $regex: `^KSU/REQ/${year}/` },
  });
  const seq = String(count + 1).padStart(4, "0");
  return `KSU/REQ/${year}/${seq}`;
}

// Creates or updates a draft. If `requisitionId` is provided, updates that
// draft in place (only allowed while status is draft or returned).
export async function saveDraft({ requisitionId, requesterUser, payload }) {
  const items = computeItemTotals(payload.items || []);
  const estimatedCost = sumEstimatedCost(items);

  const data = {
    category: payload.category,
    purpose: payload.purpose,
    urgency: payload.urgency,
    items,
    estimatedCost,
  };

  let requisition;
  if (requisitionId) {
    requisition = await Requisition.findOneAndUpdate(
      { _id: requisitionId, requester: requesterUser.id, status: REQUISITION_STATUS.DRAFT },
      { $set: data },
      { new: true }
    );
    if (!requisition) throw new Error("Draft not found or not editable.");
  } else {
    requisition = await Requisition.create({
      ...data,
      requester: requesterUser.id,
      collegeId: requesterUser.collegeId,
      facultyId: requesterUser.facultyId,
      department: requesterUser.department,
      status: REQUISITION_STATUS.DRAFT,
    });
  }

  await AuditLog.create({
    actor: requesterUser.id,
    action: requisitionId ? "requisition.draft_update" : "requisition.draft_create",
    entityType: "Requisition",
    entityId: requisition._id,
  });

  return requisition;
}

// Transitions a draft (or a returned-to-requester requisition) into the
// approval chain. Fresh drafts get a brand-new chain built from scratch.
// A requisition that was returned all the way back to the requester keeps
// its requisition number but also gets a freshly rebuilt chain, since the
// requester may have changed details that affect routing/escalation.
export async function submitRequisition({ requisitionId, requesterUser }) {
  const requisition = await Requisition.findOne({ _id: requisitionId, requester: requesterUser.id });
  if (!requisition) throw new Error("Requisition not found.");

  const isFreshDraft = requisition.status === REQUISITION_STATUS.DRAFT;
  const isReturnedToRequester =
    requisition.status === REQUISITION_STATUS.RETURNED && requisition.awaitingRequesterAction;

  if (!isFreshDraft && !isReturnedToRequester) {
    throw new Error("This requisition is not awaiting your submission.");
  }

  const { chain, requiresGovernorApproval } = await buildApprovalChain({
    collegeId: requisition.collegeId,
    facultyId: requisition.facultyId,
    department: requisition.department,
    estimatedCost: requisition.estimatedCost,
  });

  requisition.approvalChain = chain;
  requisition.requiresGovernorApproval = requiresGovernorApproval;
  requisition.currentStepIndex = 0;
  requisition.awaitingRequesterAction = false;
  requisition.status = REQUISITION_STATUS.PENDING;
  requisition.submittedAt = new Date();
  if (!requisition.requisitionNumber) {
    requisition.requisitionNumber = await generateRequisitionNumber();
  }

  await requisition.save();

  await AuditLog.create({
    actor: requesterUser.id,
    action: "requisition.submit",
    entityType: "Requisition",
    entityId: requisition._id,
    details: { requiresGovernorApproval, resubmission: isReturnedToRequester },
  });

  await sendRequisitionSubmittedEmail(requesterUser, requisition);

  const firstStep = chain[0];
  if (firstStep?.approver) {
    const approver = await User.findById(firstStep.approver);
    if (approver) await sendApprovalStepEmail(approver, requisition);
  }

  return requisition;
}

export function isRequisitionEscalated(estimatedCost) {
  return isEscalated(estimatedCost);
}
