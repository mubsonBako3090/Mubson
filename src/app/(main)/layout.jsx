import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AuthHydrator from "@/components/layout/AuthHydrator";
import styles from "./main-layout.module.css";

export default async function MainLayout({ children }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className={styles.shell}>
      <AuthHydrator user={user} />
      <Sidebar role={user.role} />
      <div className={styles.content}>
        <Navbar />
        <main className={styles.main}>{children}</main>
        <Footer />
      </div>
    </div>
  );
}
