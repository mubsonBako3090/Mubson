import styles from "./StatCard.module.css";

export default function StatCard({ label, value, icon, tone = "primary" }) {
  return (
    <div className={styles.card}>
      <div className={`${styles.iconWrap} ${styles[tone]}`}>
        <i className={`bi ${icon}`} />
      </div>
      <div>
        <div className={styles.value}>{value ?? "—"}</div>
        <div className={styles.label}>{label}</div>
      </div>
    </div>
  );
}
