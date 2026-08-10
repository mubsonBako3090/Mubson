import { REQUISITION_STATUS_LABELS } from "@/constants/requisitionOptions";
import styles from "./Badge.module.css";

// `status` should be one of the REQUISITION_STATUS values; falls back to
// rendering the raw string for anything else.
export default function Badge({ status }) {
  const label = REQUISITION_STATUS_LABELS[status] || status;
  return <span className={`${styles.badge} ${styles[status] || ""}`}>{label}</span>;
}
