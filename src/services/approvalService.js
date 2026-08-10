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

/*
 * Loads a requisition and confirms that the authenticated user
 * is the person assigned to the current approval step.
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

  /*
   * A requisition must normally be PENDING.
   *
   * A RETURNED requisition is also allowed when it has been
   * returned to a previous approver rather than the requester.
   */
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
      "No approval step exists for the current position."
    );
  }

  if (
    !step.approver ||
    String(step.approver) !==
      String(approverId)
  ) {
    throw new Error(
      "You are not the assigned approver for this requisition's current step."
    );
  }

  return requisition;
}

/*
 * Approve the current step.
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

  const currentStepIndex =
    requisition.currentStepIndex;

  const step =
    requisition.approvalChain[
      currentStepIndex
    ];

  /*
   * Record the approval BEFORE changing the current step.
   */
  await Approval.create({
    requisition:
      requisition._id,

    stepIndex:
      currentStepIndex,

    role:
      step.role,

    approver:
      approverUser.id,

    action:
      APPROVAL_ACTIONS.APPROVE,

    comment,
  });

  const isLastStep =
    currentStepIndex ===
    requisition.approvalChain.length - 1;

  if (isLastStep) {
    /*
     * Final approval.
     */
    requisition.status =
      REQUISITION_STATUS.APPROVED;

    requisition.decidedAt =
      new Date();

    requisition.awaitingRequesterAction =
      false;
  } else {
    /*
     * Move to the next person in the chain.
     */
    requisition.currentStepIndex =
      currentStepIndex + 1;

    requisition.status =
      REQUISITION_STATUS.PENDING;

    requisition.awaitingRequesterAction =
      false;
  }

  await requisition.save();

  await AuditLog.create({
    actor: approverUser.id,

    action:
      "requisition.approve",

    entityType:
      "Requisition",

    entityId:
      requisition._id,

    details: {
      stepIndex:
        currentStepIndex,

      role:
        step.role,

      nextStepIndex:
        isLastStep
          ? null
          : currentStepIndex + 1,
    },
  });

  /*
   * If this was the final step, notify the requester.
   */
  if (isLastStep) {
    await sendRequisitionApprovedEmail(
      requisition.requester,
      requisition
    );
  } else {
    /*
     * Notify the next approver.
     */
    const nextStep =
      requisition.approvalChain[
        requisition.currentStepIndex
      ];

    if (nextStep?.approver) {
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
  }

  return requisition;
}

/*
 * Return a requisition for clarification.
 *
 * If the current person is the first approval step,
 * it returns to the requester.
 *
 * Otherwise it goes back exactly one level in the
 * approval hierarchy.
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

  const currentStepIndex =
    requisition.currentStepIndex;

  const step =
    requisition.approvalChain[
      currentStepIndex
    ];

  await Approval.create({
    requisition:
      requisition._id,

    stepIndex:
      currentStepIndex,

    role:
      step.role,

    approver:
      approverUser.id,

    action:
      APPROVAL_ACTIONS.RETURN,

    comment,
  });

  if (currentStepIndex === 0) {
    /*
     * First approver sends it back to requester.
     */
    requisition.awaitingRequesterAction =
      true;
  } else {
    /*
     * Otherwise return to the immediately
     * preceding approval level.
     */
    requisition.currentStepIndex =
      currentStepIndex - 1;

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
      fromStepIndex:
        currentStepIndex,

      returnedToStepIndex:
        requisition.awaitingRequesterAction
          ? null
          : requisition.currentStepIndex,

      comment,
    },
  });

  await sendRequisitionReturnedEmail(
    requisition.requester,
    requisition,
    comment
  );

  /*
   * If it was returned to another approver,
   * notify that approver.
   */
  if (
    !requisition.awaitingRequesterAction
  ) {
    const previousStep =
      requisition.approvalChain[
        requisition.currentStepIndex
      ];

    if (previousStep?.approver) {
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
 * Reject a requisition.
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

  const currentStepIndex =
    requisition.currentStepIndex;

  const step =
    requisition.approvalChain[
      currentStepIndex
    ];

  await Approval.create({
    requisition:
      requisition._id,

    stepIndex:
      currentStepIndex,

    role:
      step.role,

    approver:
      approverUser.id,

    action:
      APPROVAL_ACTIONS.REJECT,

    comment,
  });

  if (isFinal) {
    /*
     * Final rejection.
     */
    requisition.status =
      REQUISITION_STATUS.REJECTED;

    requisition.decidedAt =
      new Date();

    requisition.awaitingRequesterAction =
      false;
  } else {
    /*
     * Rejection that allows requester to
     * edit and submit again.
     */
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
      stepIndex:
        currentStepIndex,

      role:
        step.role,

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
