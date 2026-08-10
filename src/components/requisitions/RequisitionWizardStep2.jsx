"use client";

import RequisitionItemsTable from "./RequisitionItemsTable";
import styles from "./RequisitionWizardStep2.module.css";

export default function RequisitionWizardStep2({ items, onChange }) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.hint}>Add each item you're requesting with quantity and unit cost.</p>
      <RequisitionItemsTable items={items} onChange={(next) => onChange({ items: next })} />
    </div>
  );
}
