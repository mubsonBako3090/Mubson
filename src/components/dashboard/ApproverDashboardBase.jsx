"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import styles from "./dashboard-grid.module.css";

export default function ApproverDashboardBase({ user, roleLabel }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get("/api/dashboard").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  return (
    <div className={styles.wrapper}>
      <div>
        <h1 className={styles.heading}>Welcome, {user.fullName.split(" ")[0]}</h1>
        <p className={styles.subheading}>
          {roleLabel} — {user.department}
        </p>
      </div>

      <div className={styles.actions}>
        <Link href="/approvals">
          <Button>
            <i className="bi bi-check2-square" /> Review Pending Approvals
          </Button>
        </Link>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Awaiting Your Approval" value={stats?.pendingMyStep} icon="bi-hourglass-split" tone="pending" />
        <StatCard label="Approved by You" value={stats?.approvedByMe} icon="bi-check-circle" tone="approved" />
      </div>
    </div>
  );
}
