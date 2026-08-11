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
 * --------------------------------------------------
 * LOAD AND VERIFY CURRENT APPROVAL STEP
 * --------------------------------------------------
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
   * Only pending requisitions can normally
   * receive an approval action.
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
      "Invalid approval step."
    );
  }

  /*
   * Make sure this user is the assigned
   * person for the current step.
   */
  if (
    String(step.approver) !==
    String(approverId)
  ) {
    throw new Error(
      "You are not the assigned approver for this requisition's current step."
    );
  }

  /*
   * Procurement is a processing stage,
   * not an approval stage.
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
 * --------------------------------------------------
 * APPROVE CURRENT STEP
 * --------------------------------------------------
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
   * Record the approval decision.
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
   * VC is the final approval authority.
   */
  const isFinalApproval =
    step.role === ROLES.VC;

  const nextIndex =
    requisition.currentStepIndex + 1;

  const nextStep =
    requisition.approvalChain[
      nextIndex
    ];

  /*
   * --------------------------------------------------
   * FINAL APPROVAL BY VC
   * --------------------------------------------------
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
     * Find Procurement stage.
     */
    const procurementStep =
      requisition.approvalChain.find(
        (approvalStep) =>
          approvalStep.role ===
            ROLES.PROCUREMENT &&
          approvalStep.type ===
            "processing"
      );

    /*
     * Assign Procurement Officer.
     */
    let procurementOfficer = null;

    if (
      procurementStep?.approver
    ) {
      procurementOfficer =
        await User.findById(
          procurementStep.approver
        );
    }

    /*
     * If the chain does not contain a
     * Procurement Officer, find an active one.
     */
    if (!procurementOfficer) {
      procurementOfficer =
        await User.findOne({
          role: ROLES.PROCUREMENT,
          accountStatus: "active",
        });
    }

    if (!procurementOfficer) {
      throw new Error(
        "No active Procurement Officer is configured."
      );
    }

    /*
     * Move current stage to Procurement.
     */
    if (procurementStep) {
      const procurementIndex =
        requisition.approvalChain.findIndex(
          (approvalStep) =>
            approvalStep.role ===
              ROLES.PROCUREMENT &&
            approvalStep.type ===
              "processing"
        );

      if (
        procurementIndex >= 0
      ) {
        requisition.currentStepIndex =
          procurementIndex;
      }
    }

    /*
     * --------------------------------------------------
     * PROCUREMENT STATUS
     * --------------------------------------------------
     *
     * VC has approved.
     *
     * Therefore Procurement can now begin.
     */
    requisition.procurementStatus =
      "ready";

    requisition.procurementOfficer =
      procurementOfficer._id;

    requisition.procurementReceivedAt =
      new Date();

    await requisition.save();

    /*
     * Audit final approval.
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
        finalApproverRole:
          step.role,

        nextStage:
          ROLES.PROCUREMENT,

        procurementOfficer:
          procurementOfficer._id,
      },
    });

    /*
     * Notify requester.
     */
    await sendRequisitionApprovedEmail(
      requisition.requester,
      requisition
    );

    /*
     * Notify Procurement Officer.
     */
    await sendApprovalStepEmail(
      procurementOfficer,
      requisition
    );

    return requisition;
  }

  /*
   * --------------------------------------------------
   * NORMAL APPROVAL
   * --------------------------------------------------
   *
   * HOD -> Dean
   * Dean -> Provost
   * Provost -> VC
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
        nextIndex,

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
 * --------------------------------------------------
 * RETURN FOR CLARIFICATION
 * --------------------------------------------------
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
   * First approval step:
   * return directly to requester.
   */
  if (
    requisition.currentStepIndex ===
    0
  ) {
    requisition.awaitingRequesterAction =
      true;
  }

  /*
   * Otherwise return to previous
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

  /*
   * If Procurement somehow returns a processing
   * stage, reset procurement status.
   */
  if (
    requisition.procurementStatus
  ) {
    requisition.procurementStatus =
      undefined;

    requisition.procurementOfficer =
      undefined;

    requisition.procurementReceivedAt =
      undefined;
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
   * Notify previous approver.
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
 * --------------------------------------------------
 * REJECT REQUISITION
 * --------------------------------------------------
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
   * Non-final rejection:
   * send back to requester for editing.
   */
  else {
    requisition.status =
      REQUISITION_STATUS.RETURNED;

    requisition.awaitingRequesterAction =
      true;

    requisition.currentStepIndex =
      0;
  }

  /*
   * Clear Procurement state if the
   * requisition is sent backward.
   */
  requisition.procurementStatus =
    undefined;

  requisition.procurementOfficer =
    undefined;

  requisition.procurementReceivedAt =
    undefined;

  requisition.procurementStartedAt =
    undefined;

  requisition.procurementCompletedAt =
    undefined;

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
