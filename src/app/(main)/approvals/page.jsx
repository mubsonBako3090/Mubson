"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import Badge from "@/components/ui/Badge";
import { formatNaira } from "@/utils/formatNaira";
import { formatDate } from "@/utils/formatDate";
import styles from "./page.module.css";

export default function ApprovalsQueuePage() {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/approvals")
      .then(({ data }) => setRequisitions(data.requisitions))
      .catch((err) => toast.error(err.response?.data?.message || "Failed to load approvals."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>Approvals Queue</h1>
      <p className={styles.subheading}>Requisitions currently awaiting your decision.</p>

      {loading ? (
        <p className={styles.hint}>Loading…</p>
      ) : requisitions.length === 0 ? (
        <p className={styles.hint}>Nothing is waiting on you right now.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Requisition No.</th>
                <th>Requester</th>
                <th>Department</th>
                <th>Estimated Cost</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((r) => (
                <tr key={r._id}>
                  <td className="mono">{r.requisitionNumber}</td>
                  <td>{r.requester?.fullName}</td>
                  <td>{r.department}</td>
                  <td className="mono">{formatNaira(r.estimatedCost)}</td>
                  <td>
                    <Badge status={r.status} />
                  </td>
                  <td>{formatDate(r.submittedAt)}</td>
                  <td>
                    <Link href={`/approvals/${r._id}`} className={styles.reviewLink}>
                      Review
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
