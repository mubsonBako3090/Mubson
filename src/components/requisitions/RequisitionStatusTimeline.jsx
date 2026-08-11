"use client";

import styles from "./RequisitionStatusTimeline.module.css";

function roleLabel(role) {
  const labels = {
    requester: "Requester",
    hod: "Head of Department",
    dean: "Dean of Faculty",
    provost: "Provost of College",
    vc: "Vice Chancellor",
    procurement: "Procurement Officer",
  };

  return (
    labels[role] ||
    role
      ?.replace(/_/g, " ")
      ?.replace(/\b\w/g, (char) => char.toUpperCase()) ||
    "Unknown"
  );
}

/*
 * Determines the status of each approval step.
 *
 * IMPORTANT:
 *
 * Procurement is NOT an approval step.
 * It is a processing stage after VC gives final approval.
 *
 * Therefore:
 *
 * HOD       -> Approved
 * Dean      -> Approved
 * Provost   -> Approved
 * VC        -> Approved
 * Procurement -> Received for Processing / Processing
 */
function getApprovalStatus(requisition, index) {
  const chain = requisition.approvalChain || [];
  const step = chain[index];

  if (!step) {
    return "waiting";
  }

  /*
   * Rejected requisition.
   */
  if (
    requisition.status === "rejected" &&
    index === requisition.currentStepIndex
  ) {
    return "rejected";
  }

  /*
   * Returned requisition.
   */
  if (
    requisition.status === "returned" &&
    index === requisition.currentStepIndex
  ) {
    return "returned";
  }

  /*
   * PROCUREMENT
   *
   * Procurement is a processing stage, not an approval.
   *
   * Once VC has approved, the requisition status becomes
   * "approved" and currentStepIndex moves to Procurement.
   *
   * Therefore Procurement should NOT appear as
   * "Pending Approval".
   */
  if (step.type === "processing") {
    return "processing";
  }

  /*
   * Every approval step before the current step
   * has already been completed.
   */
  if (index < requisition.currentStepIndex) {
    return "approved";
  }

  /*
   * If the requisition is finally approved, all actual
   * approval authorities have approved.
   */
  if (requisition.status === "approved") {
    return "approved";
  }

  /*
   * Current approval authority is waiting for action.
   */
  if (
    requisition.status === "pending" &&
    index === requisition.currentStepIndex
  ) {
    return "pending";
  }

  return "waiting";
}

function approvalText(status) {
  switch (status) {
    case "approved":
      return "Approved";

    case "pending":
      return "Pending Approval";

    case "returned":
      return "Returned for Clarification";

    case "rejected":
      return "Rejected";

    case "processing":
      return "Processing Stage";

    default:
      return "Waiting";
  }
}

/*
 * Determines the current Procurement status.
 *
 * The backend can later update procurementStatus as
 * Procurement processes the requisition.
 */
function procurementText(requisition) {
  /*
   * If the requisition has been finally approved by VC,
   * Procurement can now commence.
   */
  if (requisition.status === "approved") {
    switch (requisition.procurementStatus) {
      case "received":
        return "Received for Processing";

      case "processing":
        return "Processing";

      case "completed":
        return "Processing Completed";

      default:
        return "Ready for Procurement Processing";
    }
  }

  /*
   * Before VC approval, Procurement has not received
   * the requisition for processing yet.
   */
  return "Awaiting Final Approval";
}

export default function RequisitionStatusTimeline({
  requisition,
}) {
  if (!requisition) {
    return null;
  }

  const chain = requisition.approvalChain || [];

  /*
   * Find Procurement's position in the chain.
   */
  const procurementIndex = chain.findIndex(
    (step) => step.type === "processing"
  );

  /*
   * Find the actual approval steps.
   */
  const approvalSteps = chain.filter(
    (step) => step.type !== "processing"
  );

  /*
   * VC is the final approval authority.
   */
  const vcIndex = chain.findIndex(
    (step) => step.role === "vc"
  );

  /*
   * Final approval has been completed when:
   *
   * - status is approved
   * - OR finalApprovalAt exists
   */
  const finalApprovalCompleted =
    requisition.status === "approved" ||
    Boolean(requisition.finalApprovalAt);

  return (
    <div className={styles.container}>
      {/* ==================================================
          APPROVAL PROGRESS
      ================================================== */}

      <section className={styles.section}>
        <h3 className={styles.heading}>
          APPROVAL PROGRESS
        </h3>

        <div className={styles.timeline}>
          {approvalSteps.map((step) => {
            /*
             * Get the original index from the full chain.
             */
            const index = chain.findIndex(
              (chainStep) =>
                chainStep === step
            );

            const status =
              getApprovalStatus(
                requisition,
                index
              );

            const approver =
              step.approver;

            return (
              <div
                key={`${step.role}-${index}`}
                className={styles.item}
              >
                <div
                  className={`${styles.dot} ${
                    styles[status] || ""
                  }`}
                />

                <div className={styles.content}>
                  <div className={styles.role}>
                    {roleLabel(step.role)}
                  </div>

                  <div className={styles.person}>
                    {approver?.fullName ||
                      "Approver not assigned"}
                  </div>

                  <div className={styles.status}>
                    {approvalText(status)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* ==================================================
              FINAL APPROVAL
          ================================================== */}

          {finalApprovalCompleted && (
            <div className={styles.finalApproval}>
              ✓ Final Approval Completed
            </div>
          )}
        </div>
      </section>

      {/* ==================================================
          PROCUREMENT PROCESSING
      ================================================== */}

      <section className={styles.section}>
        <h3 className={styles.heading}>
          PROCUREMENT PROCESSING
        </h3>

        <div className={styles.procurementItem}>
          <div
            className={`${styles.dot} ${
              finalApprovalCompleted
                ? styles.processing
                : styles.waiting
            }`}
          />

          <div className={styles.content}>
            <div className={styles.role}>
              Procurement Officer
            </div>

            <div className={styles.person}>
              {chain[
                procurementIndex
              ]?.approver?.fullName ||
                requisition.procurementOfficer
                  ?.fullName ||
                "Procurement Officer"}
            </div>

            <div className={styles.status}>
              {procurementText(requisition)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
