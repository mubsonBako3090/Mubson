import Requisition from "@/models/Requisition";
import Approval from "@/models/Approval";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";
import { REQUISITION_STATUS, APPROVAL_ACTIONS } from "@/constants/requisitionOptions";
import {
  sendApprovalStepEmail,
  sendRequisitionApprovedEmail,
  sendRequisitionRejectedEmail,
  sendRequisitionReturnedEmail,
} from "@/lib/mailer";

// Loads a requisition and verifies the given user is the approver assigned
// to its current step (and that it's actually awaiting an approver, not the
// requester). Throws if not.
async function loadAndVerifyStep(requisitionId, approverId) {
  const requisition = await Requisition.findById(requisitionId).populate("requester");
  if (!requisition) throw new Error("Requisition not found.");

  if (requisition.status !== REQUISITION_STATUS.PENDING) {
    // A RETURNED requisition can also be at an approver's step (return-to-previous-approver
    // case) rather than awaiting the requester — allow action in that case too.
    const atApproverStep =
      requisition.status === REQUISITION_STATUS.RETURNED && !requisition.awaitingRequesterAction;
    if (!atApproverStep) {
      throw new Error("This requisition is not currently awaiting your action.");
    }
  }

  const step = requisition.approvalChain[requisition.currentStepIndex];
  if (!step || String(step.approver) !== String(approverId)) {
    throw new Error("You are not the assigned approver for this requisition's current step.");
  }

  return requisition;
}

export async function approveStep({ requisitionId, approverUser, comment }) {
  const requisition = await loadAndVerifyStep(requisitionId, approverUser.id);
  const step = requisition.approvalChain[requisition.currentStepIndex];

  await Approval.create({
    requisition: requisition._id,
    stepIndex: requisition.currentStepIndex,
    role: step.role,
    approver: approverUser.id,
    action: APPROVAL_ACTIONS.APPROVE,
    comment,
  });

  const isLastStep = requisition.currentStepIndex === requisition.approvalChain.length - 1;

  if (isLastStep) {
    requisition.status = REQUISITION_STATUS.APPROVED;
    requisition.decidedAt = new Date();
  } else {
    requisition.currentStepIndex += 1;
    requisition.status = REQUISITION_STATUS.PENDING;
  }
  requisition.awaitingRequesterAction = false;
  await requisition.save();

  await AuditLog.create({
    actor: approverUser.id,
    action: "requisition.approve",
    entityType: "Requisition",
    entityId: requisition._id,
    details: { stepIndex: step && requisition.currentStepIndex, role: step.role },
  });

  if (isLastStep) {
    await sendRequisitionApprovedEmail(requisition.requester, requisition);
  } else {
    const nextStep = requisition.approvalChain[requisition.currentStepIndex];
    if (nextStep?.approver) {
      const nextApprover = await User.findById(nextStep.approver);
      if (nextApprover) await sendApprovalStepEmail(nextApprover, requisition);
    }
  }

  return requisition;
}

// Returns the requisition for clarification. If there's a previous approver
// step, it routes back to them; if this is the first step, it routes back
// to the requester. The requester retains visibility either way via the
// comment thread.
export async function returnStep({ requisitionId, approverUser, comment }) {
  const requisition = await loadAndVerifyStep(requisitionId, approverUser.id);
  const step = requisition.approvalChain[requisition.currentStepIndex];

  await Approval.create({
    requisition: requisition._id,
    stepIndex: requisition.currentStepIndex,
    role: step.role,
    approver: approverUser.id,
    action: APPROVAL_ACTIONS.RETURN,
    comment,
  });

  if (requisition.currentStepIndex === 0) {
    requisition.awaitingRequesterAction = true;
  } else {
    requisition.currentStepIndex -= 1;
    requisition.awaitingRequesterAction = false;
  }
  requisition.status = REQUISITION_STATUS.RETURNED;

  if (comment) {
    requisition.comments.push({ author: approverUser.id, message: comment });
  }

  await requisition.save();

  await AuditLog.create({
    actor: approverUser.id,
    action: "requisition.return",
    entityType: "Requisition",
    entityId: requisition._id,
    details: { comment },
  });

  await sendRequisitionReturnedEmail(requisition.requester, requisition, comment);

  if (!requisition.awaitingRequesterAction) {
    const prevStep = requisition.approvalChain[requisition.currentStepIndex];
    if (prevStep?.approver) {
      const prevApprover = await User.findById(prevStep.approver);
      if (prevApprover) await sendApprovalStepEmail(prevApprover, requisition);
    }
  }

  return requisition;
}

export async function rejectStep({ requisitionId, approverUser, comment, isFinal }) {
  const requisition = await loadAndVerifyStep(requisitionId, approverUser.id);
  const step = requisition.approvalChain[requisition.currentStepIndex];

  await Approval.create({
    requisition: requisition._id,
    stepIndex: requisition.currentStepIndex,
    role: step.role,
    approver: approverUser.id,
    action: APPROVAL_ACTIONS.REJECT,
    comment,
  });

  if (isFinal) {
    requisition.status = REQUISITION_STATUS.REJECTED;
    requisition.decidedAt = new Date();
    requisition.awaitingRequesterAction = false;
  } else {
    // Rejected but resubmittable — goes fully back to the requester.
    requisition.status = REQUISITION_STATUS.RETURNED;
    requisition.awaitingRequesterAction = true;
    requisition.currentStepIndex = 0;
  }

  if (comment) {
    requisition.comments.push({ author: approverUser.id, message: comment });
  }

  await requisition.save();

  await AuditLog.create({
    actor: approverUser.id,
    action: "requisition.reject",
    entityType: "Requisition",
    entityId: requisition._id,
    details: { isFinal, comment },
  });

  await sendRequisitionRejectedEmail(requisition.requester, requisition, comment);

  return requisition;
}
