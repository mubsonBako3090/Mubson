"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLES } from "@/constants/roles";
import { useUiStore } from "@/store/uiStore";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "bi-speedometer2", roles: "all" },
  { href: "/requisitions", label: "Requisitions", icon: "bi-file-earmark-text", roles: "all" },
  {
    href: "/requisitions/consolidate",
    label: "Consolidate",
    icon: "bi-collection",
    roles: [ROLES.DEAN, ROLES.PROVOST, ROLES.VC, ROLES.PROCUREMENT],
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: "bi-check2-square",
    roles: [ROLES.HOD, ROLES.DEAN, ROLES.PROVOST, ROLES.VC],
  },
  { href: "/reports", label: "Reports", icon: "bi-bar-chart", roles: "all" },
  { href: "/audit-trail", label: "Audit Trail", icon: "bi-clock-history", roles: [ROLES.ADMIN] },
  { href: "/users", label: "Manage Users", icon: "bi-people", roles: [ROLES.ADMIN] },
  { href: "/settings", label: "Settings", icon: "bi-gear", roles: "all" },
];

export default function Sidebar({ role }) {
  const pathname = usePathname();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles === "all" || item.roles.includes(role)
  );

  function handleNavClick() {
    // On small screens the sidebar overlays content — close it after
    // navigating so it doesn't block the page. Desktop keeps it open
    // (CSS media query makes this a no-op visually above 992px).
    if (typeof window !== "undefined" && window.innerWidth < 992 && sidebarOpen) {
      toggleSidebar();
    }
  }

  return (
    <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.collapsed}`}>
      <div className={styles.brand}>
        <img src="/images (1).jpeg" alt="KSU" className={styles.logo} />
        <span className={styles.brandText}>KSU Procurement</span>
      </div>

      <nav className={styles.nav}>
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              onClick={handleNavClick}
            >
              <i className={`bi ${item.icon}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
