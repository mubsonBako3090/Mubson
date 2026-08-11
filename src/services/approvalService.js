import Requisition from "@/models/Requisition";
import Approval from "@/models/Approval";
import AuditLog from "@/models/AuditLog";
import User from "@/models/User";

import {
  REQUISITION_STATUS,
  APPROVAL_ACTIONS,
} from "@/constants/requisitionOptions";

import {
  sendApprovalStepEmail,
  sendRequisitionApprovedEmail,
  sendRequisitionRejectedEmail,
  sendRequisitionReturnedEmail,
} from "@/lib/mailer";

import { ROLES } from "@/constants/roles";

/*
 * Loads a requisition and confirms that the logged-in
 * user is the assigned person for the current approval step.
 */
async function loadAndVerifyStep(
  requisitionId,
  approverId
) {
  const requisition =
    await Requisition.findById(
      requisitionId
    ).populate("requester");

  if (!requisition) {
    throw new Error(
      "Requisition not found."
    );
  }

  if (
    requisition.status !==
    REQUISITION_STATUS.PENDING
  ) {
    const atApproverStep =
      requisition.status ===
        REQUISITION_STATUS.RETURNED &&
      !requisition.awaitingRequesterAction;

    if (!atApproverStep) {
      throw new Error(
        "This requisition is not currently awaiting your action."
      );
    }
  }

  const step =
    requisition.approvalChain[
      requisition.currentStepIndex
    ];

  if (!step) {
    throw new Error(
      "Invalid approval step."
    );
  }

  if (
    String(step.approver) !==
    String(approverId)
  ) {
    throw new Error(
      "You are not the assigned approver for this requisition's current step."
    );
  }

  /*
   * Procurement processing is NOT an approval action.
   */
  if (
    step.type === "processing"
  ) {
    throw new Error(
      "This requisition has already received final approval and is now with Procurement for processing."
    );
  }

  return requisition;
}

/*
 * Approves the current approval step.
 *
 * IMPORTANT:
 *
 * VC is the final approval authority.
 *
 * Once VC approves:
 *
 * status = APPROVED
 *
 * currentStepIndex = Procurement
 *
 * Procurement is then notified.
 */
export async function approveStep({
  requisitionId,
  approverUser,
  comment,
}) {
  const requisition =
    await loadAndVerifyStep(
      requisitionId,
      approverUser.id
    );

  const step =
    requisition.approvalChain[
      requisition.currentStepIndex
    ];

  /*
   * Record the approval.
   */
  await Approval.create({
    requisition:
      requisition._id,

    stepIndex:
      requisition.currentStepIndex,

    role:
      step.role,

    approver:
      approverUser.id,

    action:
      APPROVAL_ACTIONS.APPROVE,

    comment,
  });

  /*
   * Determine whether this is the final approval
   * authority.
   *
   * VC is final.
   */
  const isFinalApproval =
    step.role === ROLES.VC;

  /*
   * Find the next step.
   */
  const nextIndex =
    requisition.currentStepIndex + 1;

  const nextStep =
    requisition.approvalChain[
      nextIndex
    ];

  /*
   * VC has approved.
   *
   * Therefore:
   *
   * - requisition is APPROVED
   * - approval process is complete
   * - Procurement becomes the processing stage
   */
  if (isFinalApproval) {
    requisition.status =
      REQUISITION_STATUS.APPROVED;

    requisition.finalApprovalAt =
      new Date();

    requisition.decidedAt =
      new Date();

    requisition.awaitingRequesterAction =
      false;

    /*
     * Move the visible progress indicator
     * to Procurement.
     */
    if (
  nextStep &&
  nextStep.role === ROLES.PROCUREMENT
) {
  requisition.currentStepIndex =
    nextIndex;

  requisition.procurementReceivedAt =
    new Date();

  requisition.procurementStatus =
    "ready";

  requisition.procurementOfficer =
    nextStep.approver;
    }
    await requisition.save();

    await AuditLog.create({
      actor:
        approverUser.id,

      action:
        "requisition.final_approval",

      entityType:
        "Requisition",

      entityId:
        requisition._id,

      details: {
        finalApproverRole:
          step.role,

        nextStage:
          nextStep?.role || null,
      },
    });

    /*
     * Notify requester that final approval
     * has been granted.
     */
    await sendRequisitionApprovedEmail(
      requisition.requester,
      requisition
    );

    /*
     * Notify Procurement that processing can begin.
     */
    if (
      nextStep?.approver
    ) {
      const procurementOfficer =
        await User.findById(
          nextStep.approver
        );

      if (procurementOfficer) {
        await sendApprovalStepEmail(
          procurementOfficer,
          requisition
        );
      }
    }

    return requisition;
  }

  /*
   * Normal approval step:
   *
   * HOD -> Dean
   * Dean -> Provost
   * etc.
   */
  requisition.currentStepIndex =
    nextIndex;

  requisition.status =
    REQUISITION_STATUS.PENDING;

  requisition.awaitingRequesterAction =
    false;

  await requisition.save();

  await AuditLog.create({
    actor:
      approverUser.id,

    action:
      "requisition.approve",

    entityType:
      "Requisition",

    entityId:
      requisition._id,

    details: {
      stepIndex:
        requisition.currentStepIndex,

      role:
        step.role,
    },
  });

  /*
   * Notify next approver.
   */
  if (
    nextStep?.approver
  ) {
    const nextApprover =
      await User.findById(
        nextStep.approver
      );

    if (nextApprover) {
      await sendApprovalStepEmail(
        nextApprover,
        requisition
      );
    }
  }

  return requisition;
}

/*
 * Return for clarification.
 */
export async function returnStep({
  requisitionId,
  approverUser,
  comment,
}) {
  const requisition =
    await loadAndVerifyStep(
      requisitionId,
      approverUser.id
    );

  const step =
    requisition.approvalChain[
      requisition.currentStepIndex
    ];

  await Approval.create({
    requisition:
      requisition._id,

    stepIndex:
      requisition.currentStepIndex,

    role:
      step.role,

    approver:
      approverUser.id,

    action:
      APPROVAL_ACTIONS.RETURN,

    comment,
  });

  /*
   * First approval step returns to requester.
   */
  if (
    requisition.currentStepIndex ===
    0
  ) {
    requisition.awaitingRequesterAction =
      true;
  }

  /*
   * Otherwise return to the previous
   * approval authority.
   */
  else {
    requisition.currentStepIndex -=
      1;

    requisition.awaitingRequesterAction =
      false;
  }

  requisition.status =
    REQUISITION_STATUS.RETURNED;

  if (comment) {
    requisition.comments.push({
      author:
        approverUser.id,

      message:
        comment,
    });
  }

  await requisition.save();

  await AuditLog.create({
    actor:
      approverUser.id,

    action:
      "requisition.return",

    entityType:
      "Requisition",

    entityId:
      requisition._id,

    details: {
      comment,
    },
  });

  await sendRequisitionReturnedEmail(
    requisition.requester,
    requisition,
    comment
  );

  /*
   * Notify previous approver if applicable.
   */
  if (
    !requisition.awaitingRequesterAction
  ) {
    const previousStep =
      requisition.approvalChain[
        requisition.currentStepIndex
      ];

    if (
      previousStep?.approver
    ) {
      const previousApprover =
        await User.findById(
          previousStep.approver
        );

      if (previousApprover) {
        await sendApprovalStepEmail(
          previousApprover,
          requisition
        );
      }
    }
  }

  return requisition;
}

/*
 * Reject requisition.
 */
export async function rejectStep({
  requisitionId,
  approverUser,
  comment,
  isFinal,
}) {
  const requisition =
    await loadAndVerifyStep(
      requisitionId,
      approverUser.id
    );

  const step =
    requisition.approvalChain[
      requisition.currentStepIndex
    ];

  await Approval.create({
    requisition:
      requisition._id,

    stepIndex:
      requisition.currentStepIndex,

    role:
      step.role,

    approver:
      approverUser.id,

    action:
      APPROVAL_ACTIONS.REJECT,

    comment,
  });

  if (isFinal) {
    requisition.status =
      REQUISITION_STATUS.REJECTED;

    requisition.decidedAt =
      new Date();

    requisition.awaitingRequesterAction =
      false;
  } else {
    requisition.status =
      REQUISITION_STATUS.RETURNED;

    requisition.awaitingRequesterAction =
      true;

    requisition.currentStepIndex =
      0;
  }

  if (comment) {
    requisition.comments.push({
      author:
        approverUser.id,

      message:
        comment,
    });
  }

  await requisition.save();

  await AuditLog.create({
    actor:
      approverUser.id,

    action:
      "requisition.reject",

    entityType:
      "Requisition",

    entityId:
      requisition._id,

    details: {
      isFinal,
      comment,
    },
  });

  await sendRequisitionRejectedEmail(
    requisition.requester,
    requisition,
    comment
  );

  return requisition;
    }
