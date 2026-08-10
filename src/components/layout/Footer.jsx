import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <span>© {new Date().getFullYear()} Kaduna State University — Procurement Requisition System</span>
    </footer>
  );
}
