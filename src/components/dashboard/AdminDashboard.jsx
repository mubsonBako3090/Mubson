"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import styles from "./dashboard-grid.module.css";

export default function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get("/api/dashboard").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  return (
    <div className={styles.wrapper}>
      <div>
        <h1 className={styles.heading}>Welcome, {user.fullName.split(" ")[0]}</h1>
        <p className={styles.subheading}>System Administrator</p>
      </div>

      <div className={styles.actions}>
        <Link href="/users">
          <Button>
            <i className="bi bi-people" /> Manage Users
          </Button>
        </Link>
        <Link href="/audit-trail">
          <Button variant="secondary">View Audit Trail</Button>
        </Link>
      </div>

      <div className={styles.statGrid}>
        <StatCard label="Total Users" value={stats?.totalUsers} icon="bi-people" tone="primary" />
        <StatCard label="Pending Account Approvals" value={stats?.pendingUsers} icon="bi-person-check" tone="pending" />
        <StatCard label="Total Requisitions" value={stats?.totalRequisitions} icon="bi-file-earmark-text" tone="draft" />
        <StatCard label="Active Requisitions" value={stats?.activeRequisitions} icon="bi-hourglass-split" tone="approved" />
      </div>
    </div>
  );
}
