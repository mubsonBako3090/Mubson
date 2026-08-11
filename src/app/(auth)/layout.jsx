import styles from "./auth-layout.module.css";

export default function AuthLayout({ children }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.brandPanel}>
        <img src="/images (1).jpeg" alt="KSU logo" className={styles.logo} />
        <h1 className={styles.brandTitle}>KSU Procurement</h1>
        <p className={styles.brandSubtitle}>Requisition System</p>
      </div>
      <div className={styles.formPanel}>{children}</div>
    </div>
  );
}
