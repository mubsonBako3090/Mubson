"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import axios from "axios";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import { ROLE_LABELS } from "@/constants/roles";
import styles from "./page.module.css";

const TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending Approval" },
  { key: "active", label: "Active" },
  { key: "deactivated", label: "Deactivated" },
];

export default function UsersListPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (status) => {
    setLoading(true);
    try {
      const params = status ? { status } : {};
      const { data } = await axios.get("/api/users", { params });
      setUsers(data.users);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeTab);
  }, [activeTab, load]);

  async function handleApprove(userId) {
    try {
      await axios.post(`/api/users/${userId}/approve`);
      toast.success("Account approved.");
      load(activeTab);
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed.");
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Manage Users</h1>
        <Link href="/users/invite">
          <Button>
            <i className="bi bi-person-plus" /> Invite User
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
      ) : users.length === 0 ? (
        <p className={styles.hint}>No users in this category.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABELS[u.role] || u.role}</td>
                  <td>{u.department}</td>
                  <td>
                    <span className={`${styles.statusPill} ${styles[u.accountStatus]}`}>{u.accountStatus}</span>
                  </td>
                  <td className={styles.actionsCell}>
                    {u.accountStatus === "pending" && (
                      <button className={styles.approveBtn} onClick={() => handleApprove(u._id)}>
                        Approve
                      </button>
                    )}
                    <Link href={`/users/${u._id}`} className={styles.editLink}>
                      Edit
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
