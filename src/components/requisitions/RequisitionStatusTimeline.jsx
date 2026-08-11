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
      ?.replace(/\b\w/g, (char) =>
        char.toUpperCase()
      ) ||
    "Unknown"
  );
}

function getApprovalStatus(
  requisition,
  index
) {
  if (
    requisition.status === "rejected" &&
    index ===
      requisition.currentStepIndex
  ) {
    return "rejected";
  }

  if (
    requisition.status === "returned" &&
    index ===
      requisition.currentStepIndex
  ) {
    return "returned";
  }

  /*
   * Everything before the current
   * step has already been approved.
   */

  if (
    requisition.status === "approved" ||
    index <
      requisition.currentStepIndex
  ) {
    return "approved";
  }

  if (
    requisition.status === "pending" &&
    index ===
      requisition.currentStepIndex
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

    default:
      return "Waiting";
  }
}

function procurementText(
  procurementStatus
) {
  switch (procurementStatus) {
    case "received":
      return "Received for Processing";

    case "processing":
      return "Processing";

    case "completed":
      return "Processing Completed";

    default:
      return "Awaiting Final Approval";
  }
}

export default function RequisitionStatusTimeline({
  requisition,
}) {
  if (!requisition) {
    return null;
  }

  const chain =
    requisition.approvalChain || [];

  const isApproved =
    requisition.status ===
    "approved";

  return (
    <div className={styles.container}>
      {/* ------------------------------------------------
          APPROVAL PROGRESS
      ------------------------------------------------ */}

      <section className={styles.section}>
        <h3 className={styles.heading}>
          APPROVAL PROGRESS
        </h3>

        <div className={styles.timeline}>
          {chain.map(
            (step, index) => {
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
                      styles[status]
                    }`}
                  />

                  <div
                    className={
                      styles.content
                    }
                  >
                    <div
                      className={
                        styles.role
                      }
                    >
                      {roleLabel(
                        step.role
                      )}
                    </div>

                    <div
                      className={
                        styles.person
                      }
                    >
                      {approver?.fullName ||
                        "Approver not assigned"}
                    </div>

                    <div
                      className={
                        styles.status
                      }
                    >
                      {approvalText(
                        status
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          )}

          {/* ------------------------------------------------
              FINAL APPROVAL
          ------------------------------------------------ */}

          {isApproved && (
            <div
              className={styles.finalApproval}
            >
              ✓ Final Approval Completed
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------
          PROCUREMENT PROCESSING
      ------------------------------------------------ */}

      <section
        className={
          styles.section
        }
      >
        <h3 className={styles.heading}>
          PROCUREMENT PROCESSING
        </h3>

        <div
          className={
            styles.procurementItem
          }
        >
          <div
            className={`${styles.dot} ${
              requisition.procurementStatus ===
              "received" ||
              requisition.procurementStatus ===
              "processing" ||
              requisition.procurementStatus ===
              "completed"
                ? styles.approved
                : styles.waiting
            }`}
          />

          <div
            className={
              styles.content
            }
          >
            <div
              className={
                styles.role
              }
            >
              Procurement Officer
            </div>

            <div
              className={
                styles.person
              }
            >
              {requisition
                .procurementOfficer
                ?.fullName ||
                "Procurement Officer"}
            </div>

            <div
              className={
                styles.status
              }
            >
              {procurementText(
                requisition.procurementStatus
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
    }
