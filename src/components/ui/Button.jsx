"use client";

import styles from "./Button.module.css";

export default function Button({
  children,
  variant = "primary",
  type = "button",
  loading = false,
  disabled = false,
  onClick,
  fullWidth = false,
  ...rest
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${styles.btn} ${styles[variant]} ${fullWidth ? styles.fullWidth : ""}`}
      {...rest}
    >
      {loading ? <span className={styles.spinner} /> : children}
    </button>
  );
}
