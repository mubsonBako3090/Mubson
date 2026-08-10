"use client";

import styles from "./InputField.module.css";

// Reuses InputField's CSS module so all form controls share the same visual language.
export default function SelectField({ label, error, id, children, ...rest }) {
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <select id={id} className={`${styles.input} ${error ? styles.inputError : ""}`} {...rest}>
        {children}
      </select>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
