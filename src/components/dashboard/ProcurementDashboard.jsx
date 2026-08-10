"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import styles from "./dashboard-grid.module.css";

export default function ProcurementDashboard({ user }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get("/api/dashboard").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  return (
    <div className={styles.wrapper}>
      <div>
        <h1 className={styles.heading}>Welcome, {user.fullName.split(" ")[0]}</h1>
        <p className={styles.subheading}>Procurement Officer</p>
      </div>

      <div className={styles.actions}>
        <Link href="/requisitions?status=approved">
          <Button>
            <i className="bi bi-clipboard-check" /> View Approved Requisitions
          </Button>
        </Link>
      </div>

      <div className={styles.statGrid}>
        <StatCard
          label="Ready for Procurement"
          value={stats?.readyForProcurement}
          icon="bi-box-seam"
          tone="approved"
        />
      </div>
    </div>
  );
}
