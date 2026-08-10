"use client";

import { formatNaira } from "@/utils/formatNaira";
import FileUploadField from "@/components/forms/FileUploadField";
import RequisitionItemsTable from "./RequisitionItemsTable";
import styles from "./RequisitionWizardStep3.module.css";

export default function RequisitionWizardStep3({ data, requisitionId, onAttachmentsUploaded }) {
  const total = (data.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0),
    0
  );

  return (
    <div className={styles.wrapper}>
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Details</h4>
        <dl className={styles.dl}>
          <dt>Category</dt>
          <dd>{data.category || "-"}</dd>
          <dt>Urgency</dt>
          <dd>{data.urgency || "-"}</dd>
          <dt>Purpose</dt>
          <dd>{data.purpose || "-"}</dd>
        </dl>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Items</h4>
        <RequisitionItemsTable items={data.items || []} readOnly />
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Supporting Documents</h4>
        {requisitionId ? (
          <FileUploadField
            requisitionId={requisitionId}
            attachments={data.attachments || []}
            onUploaded={onAttachmentsUploaded}
          />
        ) : (
          <p className={styles.hint}>Save as draft first to attach supporting documents.</p>
        )}
      </section>

      <div className={styles.totalBanner}>
        <span>Estimated Total</span>
        <span className="mono">{formatNaira(total)}</span>
      </div>
    </div>
  );
}
