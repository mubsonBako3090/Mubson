"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import styles from "./dashboard-grid.module.css";

export default function RequesterDashboard({ user }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get("/api/dashboard").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  return (
    <div className={styles.wrapper}>
      <div>
        <h1 className={styles.heading}>Welcome, {user.fullName.split(" ")[0]}</h1>
        <p className={styles.subheading}>Here's an overview of your requisitions.</p>
      </div>

      <div className={styles.actions}>
        <Link href="/requisitions/new">
          <Button>
            <i className="bi bi-plus-lg" /> New Requisition
          </Button>
        </Link>
        <Link href="/requisitions?status=draft">
          <Button variant="secondary">Resume a Draft</Button>
        </Link>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Drafts" value={stats?.draftCount} icon="bi-file-earmark" tone="draft" />
        <StatCard label="Pending Approval" value={stats?.pendingCount} icon="bi-hourglass-split" tone="pending" />
        <StatCard label="Returned for Clarification" value={stats?.returnedCount} icon="bi-arrow-repeat" tone="returned" />
        <StatCard label="Approved" value={stats?.approvedCount} icon="bi-check-circle" tone="approved" />
        <StatCard label="Rejected" value={stats?.rejectedCount} icon="bi-x-circle" tone="rejected" />
      </div>
    </div>
  );
}
