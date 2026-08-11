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

import {
  resolveProcurementOfficer,
} from "@/lib/routing";

/*
|--------------------------------------------------------------------------
| Load and verify current approval step
|--------------------------------------------------------------------------
*/

async function loadAndVerifyStep(
  requisitionId,
  approverId
) {
  const requisition =
    await Requisition.findById(
      requisitionId
    )
      .populate("requester")
      .populate("procurementOfficer");

  if (!requisition) {
    throw new Error(
      "Requisition not found."
    );
  }

  /*
   * Approval actions are allowed only
   * while the requisition is awaiting
   * an approval.
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
      "No active approval step exists."
    );
  }

  /*
   * Security:
   * The logged-in user MUST be the
   * assigned approver.
   */

  if (
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
|--------------------------------------------------------------------------
| APPROVE
|--------------------------------------------------------------------------
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
   * Record approval.
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

  const isLastApprovalStep =
    requisition.currentStepIndex ===
    requisition.approvalChain.length - 1;

  /*
   |--------------------------------------------------------------------------
   | LAST APPROVAL = FINAL APPROVAL
   |--------------------------------------------------------------------------
   */

  if (isLastApprovalStep) {
    /*
     * The final approval authority
     * has approved the requisition.
     */

    requisition.status =
      REQUISITION_STATUS.APPROVED;

    requisition.decidedAt =
      new Date();

    requisition.awaitingRequesterAction =
      false;

    /*
     * Procurement is now allowed
     * to commence processing.
     */

    const procurementOfficer =
      await resolveProcurementOfficer();

    if (procurementOfficer) {
      requisition.procurementOfficer =
        procurementOfficer._id;

      requisition.procurementStatus =
        "received";

      requisition.procurementReceivedAt =
        new Date();
    }

    await requisition.save();

    /*
     |--------------------------------------------------------------------------
     | Audit final approval
     |--------------------------------------------------------------------------
     */

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
        role:
          step.role,

        comment,
      },
    });

    /*
     |--------------------------------------------------------------------------
     | Notify requester
     |--------------------------------------------------------------------------
     */

    await sendRequisitionApprovedEmail(
      requisition.requester,
      requisition
    );

    /*
     |--------------------------------------------------------------------------
     | Notify Procurement
     |--------------------------------------------------------------------------
     */

    if (procurementOfficer) {
      await sendApprovalStepEmail(
        procurementOfficer,
        requisition
      );
    }

    return requisition;
  }

  /*
   |--------------------------------------------------------------------------
   | NOT THE LAST APPROVAL STEP
   |--------------------------------------------------------------------------
   */

  requisition.currentStepIndex += 1;

  requisition.status =
    REQUISITION_STATUS.PENDING;

  requisition.awaitingRequesterAction =
    false;

  await requisition.save();

  /*
   |--------------------------------------------------------------------------
   | Audit
   |--------------------------------------------------------------------------
   */

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
        requisition.currentStepIndex - 1,

      role:
        step.role,

      comment,
    },
  });

  /*
   |--------------------------------------------------------------------------
   | Notify next approver
   |--------------------------------------------------------------------------
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

  return requisition;
}

/*
|--------------------------------------------------------------------------
| RETURN FOR CLARIFICATION
|--------------------------------------------------------------------------
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
   * First approver returns to requester.
   */

  if (
    requisition.currentStepIndex === 0
  ) {
    requisition.awaitingRequesterAction =
      true;
  }

  /*
   * Otherwise return to previous
   * approval authority.
   */

  else {
    requisition.currentStepIndex -= 1;

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

  /*
   * Audit
   */

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

  /*
   * Notify requester.
   */

  await sendRequisitionReturnedEmail(
    requisition.requester,
    requisition,
    comment
  );

  /*
   * Notify previous approver if
   * the requisition did not go back
   * all the way to requester.
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
|--------------------------------------------------------------------------
| REJECT
|--------------------------------------------------------------------------
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

  /*
   * Final rejection.
   */

  if (isFinal) {
    requisition.status =
      REQUISITION_STATUS.REJECTED;

    requisition.decidedAt =
      new Date();

    requisition.awaitingRequesterAction =
      false;
  }

  /*
   * Rejection that allows requester
   * to edit and resubmit.
   */

  else {
    requisition.status =
      REQUISITION_STATUS.RETURNED;

    requisition.awaitingRequesterAction =
      true;

    requisition.currentStepIndex = 0;
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

  /*
   * Audit
   */

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
