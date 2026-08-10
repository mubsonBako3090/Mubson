"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import StatCard from "@/components/ui/StatCard";
import SelectField from "@/components/forms/SelectField";
import InputField from "@/components/forms/InputField";
import { formatNaira } from "@/utils/formatNaira";
import { REQUISITION_STATUS_LABELS } from "@/constants/requisitionOptions";
import { COLLEGES } from "@/constants/colleges";
import styles from "./page.module.css";

function BreakdownBar({ label, count, totalCost, maxCount }) {
  const widthPct = maxCount ? Math.max((count / maxCount) * 100, 4) : 4;
  return (
    <div className={styles.barRow}>
      <div className={styles.barLabelRow}>
        <span className={styles.barLabel}>{label}</span>
        <span className={styles.barValue}>
          {count} · {formatNaira(totalCost)}
        </span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [filters, setFilters] = useState({ from: "", to: "", collegeId: "" });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.collegeId) params.collegeId = filters.collegeId;
      const { data } = await axios.get("/api/reports", { params });
      setReport(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const maxCollegeCount = report ? Math.max(...report.byCollege.map((c) => c.count), 1) : 1;
  const maxDeptCount = report ? Math.max(...report.byDepartment.map((c) => c.count), 1) : 1;
  const maxCategoryCount = report ? Math.max(...report.byCategory.map((c) => c.count), 1) : 1;

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.heading}>Reports & Analytics</h1>

      <div className={styles.filters}>
        <InputField
          id="from"
          label="From"
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
        <InputField
          id="to"
          label="To"
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
        <SelectField
          id="collegeId"
          label="College"
          value={filters.collegeId}
          onChange={(e) => setFilters({ ...filters, collegeId: e.target.value })}
        >
          <option value="">All colleges</option>
          {COLLEGES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>

      {loading ? (
        <p className={styles.hint}>Loading…</p>
      ) : !report ? (
        <p className={styles.hint}>Unable to load reports right now. Try adjusting the filters or refreshing.</p>
      ) : (
        <>
          <div className={styles.statGrid}>
            <StatCard label="Total Requisitions" value={report.totals.count} icon="bi-file-earmark-text" tone="primary" />
            <StatCard label="Total Estimated Value" value={formatNaira(report.totals.totalCost)} icon="bi-cash-stack" tone="approved" />
          </div>

          <div className={styles.panelsGrid}>
            <section className={styles.panel}>
              <h4 className={styles.panelTitle}>By Status</h4>
              {report.byStatus.map((s) => (
                <BreakdownBar
                  key={s._id}
                  label={REQUISITION_STATUS_LABELS[s._id] || s._id}
                  count={s.count}
                  totalCost={s.totalCost}
                  maxCount={Math.max(...report.byStatus.map((x) => x.count), 1)}
                />
              ))}
            </section>

            <section className={styles.panel}>
              <h4 className={styles.panelTitle}>By College</h4>
              {report.byCollege.map((c) => (
                <BreakdownBar key={c._id} label={c.name} count={c.count} totalCost={c.totalCost} maxCount={maxCollegeCount} />
              ))}
            </section>

            <section className={styles.panel}>
              <h4 className={styles.panelTitle}>By Department</h4>
              {report.byDepartment.map((d) => (
                <BreakdownBar key={d._id} label={d._id} count={d.count} totalCost={d.totalCost} maxCount={maxDeptCount} />
              ))}
            </section>

            <section className={styles.panel}>
              <h4 className={styles.panelTitle}>By Category</h4>
              {report.byCategory.map((c) => (
                <BreakdownBar key={c._id} label={c._id || "Uncategorized"} count={c.count} totalCost={c.totalCost} maxCount={maxCategoryCount} />
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
