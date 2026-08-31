"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import styles from "./dashboard-grid.module.css";

export default function ProcurementDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data } = await axios.get("/api/dashboard");
        setStats(data);
      } catch (error) {
        console.error("Failed to load Procurement dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const value = (key) => (loading ? "..." : stats?.[key] ?? 0);

  return (
    <div className={styles.wrapper}>
      <div>
        <h1 className={styles.heading}>Welcome, {user.fullName.split(" ")[0]}</h1>
        <p className={styles.subheading}>Procurement Officer — Market Survey, VC Submission & Processing</p>
      </div>

      <div className={styles.actions}>
        <Link href="/approvals?stage=market-survey"><Button><i className="bi bi-search" /> Market Survey Queue</Button></Link>
        <Link href="/approvals?stage=awaiting-vc"><Button variant="secondary"><i className="bi bi-hourglass" /> Awaiting VC</Button></Link>
        <Link href="/approvals?stage=processing"><Button variant="secondary"><i className="bi bi-box-seam" /> Processing Queue</Button></Link>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Market Survey Queue" value={value("marketSurveyCount")} icon="bi-search" tone="pending" />
        <StatCard label="Awaiting VC" value={value("awaitingVcCount")} icon="bi-hourglass" tone="pending" />
        <StatCard label="Ready for Processing" value={value("readyForProcurement")} icon="bi-box-seam" tone="approved" />
        <StatCard label="Currently Processing" value={value("processingCount")} icon="bi-hourglass-split" tone="pending" />
        <StatCard label="Processing Completed" value={value("completedCount")} icon="bi-check-circle" tone="approved" />
        <StatCard label="Total Procurement Items" value={value("totalProcurementItems")} icon="bi-clipboard-data" tone="primary" />
      </div>
    </div>
  );
}
