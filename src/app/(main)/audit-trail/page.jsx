"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import SelectField from "@/components/forms/SelectField";
import { formatDateTime } from "@/utils/formatDate";
import styles from "./page.module.css";

const ACTION_OPTIONS = [
  "login",
  "user.self_register",
  "user.register_admin",
  "user.invite",
  "user.approve",
  "user.edit",
  "user.deactivate",
  "user.reactivate",
  "user.password_reset",
  "requisition.draft_create",
  "requisition.draft_update",
  "requisition.submit",
  "requisition.comment",
  "requisition.approve",
  "requisition.return",
  "requisition.reject",
];

const ENTITY_OPTIONS = ["User", "Requisition", "Approval"];

export default function AuditTrailPage() {
  const [filters, setFilters] = useState({ action: "", entityType: "" });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      const { data } = await axios.get("/api/audit-trail", { params });
      setLogs(data.logs);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load audit trail.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>Audit Trail</h1>
      <p className={styles.subheading}>Every status change, login, and edit across the system.</p>

      <div className={styles.filters}>
        <SelectField
          id="action"
          label="Action"
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="entityType"
          label="Entity"
          value={filters.entityType}
          onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
        >
          <option value="">All entities</option>
          {ENTITY_OPTIONS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </SelectField>
      </div>

      {loading ? (
        <p className={styles.hint}>Loading…</p>
      ) : logs.length === 0 ? (
        <p className={styles.hint}>No log entries match these filters.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td className="mono">{formatDateTime(log.createdAt)}</td>
                  <td>{log.actor?.fullName || "System"}</td>
                  <td>
                    <code className={styles.actionCode}>{log.action}</code>
                  </td>
                  <td>{log.entityType || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
