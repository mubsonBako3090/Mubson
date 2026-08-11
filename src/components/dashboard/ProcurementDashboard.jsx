"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";

import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";

import styles from "./dashboard-grid.module.css";

export default function ProcurementDashboard({
  user,
}) {
  const [stats, setStats] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data } =
          await axios.get(
            "/api/dashboard"
          );

        setStats(data);
      } catch (error) {
        console.error(
          "Failed to load Procurement dashboard:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <div
      className={
        styles.wrapper
      }
    >
      <div>
        <h1
          className={
            styles.heading
          }
        >
          Welcome,{" "}
          {user.fullName.split(
            " "
          )[0]}
        </h1>

        <p
          className={
            styles.subheading
          }
        >
          Procurement Officer — Procurement Processing
        </p>
      </div>

      <div
        className={
          styles.actions
        }
      >
        <Link
          href="/requisitions?status=approved"
        >
          <Button>
            <i className="bi bi-clipboard-check" />{" "}
            View Approved Requisitions
          </Button>
        </Link>
      </div>

      <div
        className={
          styles.statGrid
        }
      >
        <StatCard
          label="Ready for Procurement"
          value={
            loading
              ? "..."
              : stats?.readyForProcurement ??
                0
          }
          icon="bi-box-seam"
          tone="approved"
        />

        <StatCard
          label="Processing"
          value={
            loading
              ? "..."
              : stats?.processingCount ??
                0
          }
          icon="bi-hourglass-split"
          tone="pending"
        />

        <StatCard
          label="Processing Completed"
          value={
            loading
              ? "..."
              : stats?.completedCount ??
                0
          }
          icon="bi-check-circle"
          tone="approved"
        />

        <StatCard
          label="Total Procurement Items"
          value={
            loading
              ? "..."
              : stats?.totalProcurementItems ??
                0
          }
          icon="bi-clipboard-data"
          tone="primary"
        />
      </div>
    </div>
  );
}
