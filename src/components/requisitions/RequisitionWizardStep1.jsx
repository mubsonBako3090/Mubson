"use client";

import SelectField from "@/components/forms/SelectField";
import styles from "./RequisitionWizardStep1.module.css";
import { REQUISITION_CATEGORIES, URGENCY_LEVELS } from "@/constants/requisitionOptions";

export default function RequisitionWizardStep1({ data, onChange }) {
  return (
    <div className={styles.wrapper}>
      <SelectField
        id="category"
        label="Category"
        required
        value={data.category || ""}
        onChange={(e) => onChange({ category: e.target.value })}
      >
        <option value="">Select category</option>
        {REQUISITION_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="urgency"
        label="Urgency"
        required
        value={data.urgency || ""}
        onChange={(e) => onChange({ urgency: e.target.value })}
      >
        <option value="">Select urgency</option>
        {URGENCY_LEVELS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </SelectField>

      <div className={styles.field}>
        <label htmlFor="purpose" className={styles.label}>
          Purpose / Justification
        </label>
        <textarea
          id="purpose"
          className={styles.textarea}
          rows={4}
          required
          value={data.purpose || ""}
          onChange={(e) => onChange({ purpose: e.target.value })}
          placeholder="Explain why this requisition is needed…"
        />
      </div>
    </div>
  );
}
