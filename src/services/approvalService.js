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
export async function loadAndVerifyStep(
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

/*
 * --------------------------------------------------
 * PARTIAL RESOLVE (consolidated requisitions only)
 * --------------------------------------------------
 *
 * Lets the CURRENT approver on a pending consolidated
 * requisition split off ONE source requisition instead of
 * deciding on the whole merged batch at once — e.g. a
 * Provost approving 4 of 6 merged departments while
 * sending the other 2 back.
 *
 * action "return": the split-off source is revived exactly
 * as it was before being folded in — same status, same
 * frozen approvalChain/currentStepIndex — so it lands back
 * with whichever approver (e.g. the Dean who consolidated
 * it) it was already waiting on, with this comment attached
 * for context. Nothing about its own chain changes; only
 * the fact that it's no longer merged does.
 *
 * action "reject": the split-off source is terminated,
 * exactly like a normal final rejection.
 *
 * The remaining consolidated requisition stays PENDING at
 * the SAME step — the approver can keep splitting, or
 * fully approve what's left. If nothing is left, the
 * consolidated requisition itself is closed out.
 */
export async function partialResolveSource({
  requisitionId,
  approverUser,
  sourceRequisitionId,
  action,
  comment,
}) {
  if (
    action !== "return" &&
    action !== "reject"
  ) {
    throw new Error(
      "Invalid action."
    );
  }

  if (!comment?.trim()) {
    throw new Error(
      "A comment is required."
    );
  }

  const requisition =
    await loadAndVerifyStep(
      requisitionId,
      approverUser.id
    );

  if (!requisition.isConsolidated) {
    throw new Error(
      "This requisition is not a consolidated requisition."
    );
  }

  const stillIncluded =
    requisition.sourceRequisitions.some(
      (id) =>
        String(id) ===
        String(sourceRequisitionId)
    );

  if (!stillIncluded) {
    throw new Error(
      "That requisition is not part of this consolidation."
    );
  }

  const step =
    requisition.approvalChain[
      requisition.currentStepIndex
    ];

  /*
   * --------------------------------------------------
   * SPLIT OFF THE SOURCE
   * --------------------------------------------------
   */
  requisition.sourceRequisitions =
    requisition.sourceRequisitions.filter(
      (id) =>
        String(id) !==
        String(sourceRequisitionId)
    );

  requisition.items =
    requisition.items.filter(
      (item) =>
        String(
          item.sourceRequisitionId
        ) !==
        String(sourceRequisitionId)
    );

  const source =
    await Requisition.findById(
      sourceRequisitionId
    ).populate("requester");

  if (!source) {
    throw new Error(
      "Source requisition not found."
    );
  }

  source.comments.push({
    author: approverUser.id,
    message: comment,
  });

  if (action === "return") {
    /*
     * Revive it exactly as it was — its own
     * status/approvalChain/currentStepIndex are
     * untouched, since consolidating never
     * changed them in the first place.
     */
    source.consolidatedInto =
      undefined;

    source.consolidatedAt =
      undefined;

    await source.save();

    await Approval.create({
      requisition: requisition._id,
      stepIndex:
        requisition.currentStepIndex,
      role: step.role,
      approver: approverUser.id,
      action: APPROVAL_ACTIONS.RETURN,
      comment,
    });

    await sendRequisitionReturnedEmail(
      source.requester,
      source,
      comment
    );

    /*
     * Notify whichever approver the source is
     * now waiting on again (its own frozen step).
     */
    const sourceStep =
      source.approvalChain[
        source.currentStepIndex
      ];

    if (sourceStep?.approver) {
      const sourceApprover =
        await User.findById(
          sourceStep.approver
        );

      if (sourceApprover) {
        await sendApprovalStepEmail(
          sourceApprover,
          source
        );
      }
    }
  } else {
    /*
     * Terminate it, same as a normal final rejection.
     */
    source.status =
      REQUISITION_STATUS.REJECTED;

    source.decidedAt = new Date();

    source.awaitingRequesterAction =
      false;

    source.consolidatedInto =
      undefined;

    source.consolidatedAt =
      undefined;

    source.procurementStatus =
      undefined;

    source.procurementOfficer =
      undefined;

    source.procurementReceivedAt =
      undefined;

    await source.save();

    await Approval.create({
      requisition: requisition._id,
      stepIndex:
        requisition.currentStepIndex,
      role: step.role,
      approver: approverUser.id,
      action: APPROVAL_ACTIONS.REJECT,
      comment,
    });

    await sendRequisitionRejectedEmail(
      source.requester,
      source,
      comment
    );
  }

  await AuditLog.create({
    actor: approverUser.id,
    action:
      "requisition.consolidated_partial_" +
      action,
    entityType: "Requisition",
    entityId: requisition._id,
    details: {
      sourceRequisitionId: String(
        sourceRequisitionId
      ),
      comment,
    },
  });

  /*
   * --------------------------------------------------
   * RECOMPUTE OR CLOSE THE CONSOLIDATED REQUISITION
   * --------------------------------------------------
   */
  let closed = false;

  if (
    requisition.sourceRequisitions
      .length === 0
  ) {
    closed = true;

    requisition.status =
      REQUISITION_STATUS.REJECTED;

    requisition.decidedAt =
      new Date();

    requisition.awaitingRequesterAction =
      false;

    requisition.comments.push({
      author: approverUser.id,
      message:
        "Consolidated requisition closed automatically — no requisitions remain after being handled separately.",
    });
  } else {
    const unitMap = new Map();

    for (const item of requisition.items) {
      const key = [
        item.requestingCollegeId,
        item.requestingFacultyId,
        item.requestingDepartment,
      ].join("|");

      if (!unitMap.has(key)) {
        unitMap.set(key, {
          collegeId:
            item.requestingCollegeId,
          facultyId:
            item.requestingFacultyId,
          department:
            item.requestingDepartment,
        });
      }
    }

    const requestingUnits = [
      ...unitMap.values(),
    ];

    const distinctColleges = [
      ...new Set(
        requestingUnits.map(
          (u) => u.collegeId
        )
      ),
    ];

    const distinctFaculties = [
      ...new Set(
        requestingUnits.map(
          (u) => u.facultyId
        )
      ),
    ];

    requisition.requestingUnits =
      requestingUnits;

    requisition.collegeId =
      distinctColleges.length === 1
        ? distinctColleges[0]
        : "N/A";

    requisition.facultyId =
      distinctColleges.length ===
        1 &&
      distinctFaculties.length === 1
        ? distinctFaculties[0]
        : "N/A";

    requisition.department =
      requestingUnits.length === 1
        ? requestingUnits[0]
            .department
        : "N/A";

    requisition.isConsolidated =
      requestingUnits.length > 1;

    requisition.estimatedCost =
      requisition.items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.totalCost || 0
          ),
        0
      );
  }

  await requisition.save();

  return { requisition, source, closed };
        }

