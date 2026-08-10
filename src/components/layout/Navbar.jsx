"use client";

import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import { ROLE_LABELS } from "@/constants/roles";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  async function handleLogout() {
    try {
      await axios.post("/api/auth/logout");
      clearUser();
      router.push("/login");
    } catch (err) {
      toast.error("Logout failed.");
    }
  }

  return (
    <header className={styles.navbar}>
      <button className={styles.toggleBtn} onClick={toggleSidebar} aria-label="Toggle sidebar">
        <i className="bi bi-list" />
      </button>

      <div className={styles.spacer} />

      {user && (
        <div className={styles.userMenu}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.fullName}</span>
            <span className={styles.userRole}>{ROLE_LABELS[user.role]}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Log out">
            <i className="bi bi-box-arrow-right" />
          </button>
        </div>
      )}
    </header>
  );
}
