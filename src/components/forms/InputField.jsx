"use client";

import styles from "./InputField.module.css";

export default function InputField({ label, error, id, ...rest }) {
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <input id={id} className={`${styles.input} ${error ? styles.inputError : ""}`} {...rest} />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
