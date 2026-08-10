"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { formatNaira } from "@/utils/formatNaira";
import { formatDate } from "@/utils/formatDate";
import { REQUISITION_STATUS } from "@/constants/requisitionOptions";
import styles from "./page.module.css";

const TABS = [
  { key: "all", label: "All" },
  { key: REQUISITION_STATUS.DRAFT, label: "Drafts" },
  { key: REQUISITION_STATUS.PENDING, label: "Pending" },
  { key: REQUISITION_STATUS.RETURNED, label: "Returned" },
  { key: REQUISITION_STATUS.APPROVED, label: "Approved" },
  { key: REQUISITION_STATUS.REJECTED, label: "Rejected" },
];

const VALID_TAB_KEYS = TABS.map((t) => t.key);

// Wrapped below in <Suspense> because useSearchParams() requires it —
// without the boundary, Next.js fails the build for any page that reads
// search params.
function RequisitionsListContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const initialTab = VALID_TAB_KEYS.includes(initialStatus) ? initialStatus : "all";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (tab) => {
    setLoading(true);
    try {
      const params = tab !== "all" ? { status: tab } : {};
      const { data } = await axios.get("/api/requisitions", { params });
      setRequisitions(data.requisitions);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load requisitions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeTab);
  }, [activeTab, load]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Requisitions</h1>
        <Link href="/requisitions/new">
          <Button>
            <i className="bi bi-plus-lg" /> New Requisition
          </Button>
        </Link>
      </div>

      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className={styles.hint}>Loading…</p>
      ) : requisitions.length === 0 ? (
        <p className={styles.hint}>No requisitions found in this category.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Requisition No.</th>
                <th>Category</th>
                <th>Estimated Cost</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((r) => (
                <tr key={r._id}>
                  <td className="mono">{r.requisitionNumber || "DRAFT"}</td>
                  <td>{r.category || "-"}</td>
                  <td className="mono">{formatNaira(r.estimatedCost)}</td>
                  <td>
                    <Badge status={r.status} />
                  </td>
                  <td>{formatDate(r.updatedAt)}</td>
                  <td>
                    <Link
                      href={
                        r.status === REQUISITION_STATUS.DRAFT
                          ? `/requisitions/${r._id}/edit`
                          : `/requisitions/${r._id}`
                      }
                      className={styles.viewLink}
                    >
                      {r.status === REQUISITION_STATUS.DRAFT ? "Resume" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RequisitionsListPage() {
  return (
    <Suspense fallback={<p className={styles.hint}>Loading…</p>}>
      <RequisitionsListContent />
    </Suspense>
  );
}
