import { ROLE_LABELS } from "@/constants/roles";
import styles from "./RequisitionStatusTimeline.module.css";

// `approvalChain` is [{ role, approver }], `currentStepIndex` marks progress,
// `status` tells us whether to render the whole chain as approved/rejected.
export default function RequisitionStatusTimeline({ approvalChain = [], currentStepIndex = 0, status }) {
  if (!approvalChain.length) {
    return <p className={styles.empty}>Approval routing will be assigned on submission.</p>;
  }

  return (
    <ol className={styles.timeline}>
      {approvalChain.map((step, i) => {
        let state = "upcoming";
        if (status === "rejected" && i === currentStepIndex) state = "rejected";
        else if (status === "returned" && i === currentStepIndex) state = "returned";
        else if (i < currentStepIndex || status === "approved") state = "done";
        else if (i === currentStepIndex) state = "current";

        return (
          <li key={i} className={`${styles.step} ${styles[state]}`}>
            <span className={styles.dot} />
            <div>
              <div className={styles.stepLabel}>{ROLE_LABELS[step.role] || step.role}</div>
              {step.approver?.fullName && (
                <div className={styles.approverName}>{step.approver.fullName}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
