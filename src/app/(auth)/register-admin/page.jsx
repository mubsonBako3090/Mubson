"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import axios from "axios";
import InputField from "@/components/forms/InputField";
import Button from "@/components/ui/Button";
import styles from "./page.module.css";

const initialState = { fullName: "", email: "", password: "", confirmPassword: "" };

export default function RegisterAdminPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    axios
      .get("/api/auth/register-admin")
      .then(({ data }) => setOpen(data.open))
      .catch(() => setOpen(false))
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await axios.post("/api/auth/register-admin", {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
      });
      toast.success("Administrator account created.");
      router.push("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <div className={styles.card}>Checking availability…</div>;
  }

  if (!open) {
    return (
      <div className={styles.card}>
        <h2 className={styles.title}>Administrator registration closed</h2>
        <p className={styles.subtitle}>
          The system already has the maximum of 2 administrator accounts.
        </p>
        <Link href="/login" className={styles.link}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Register administrator</h2>
      <p className={styles.subtitle}>
        This route is only available while fewer than 2 administrator accounts exist.
      </p>

      <form onSubmit={handleSubmit}>
        <InputField
          id="fullName"
          label="Full name"
          required
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <InputField
          id="email"
          label="Email address"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <InputField
          id="password"
          label="Password"
          type="password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <InputField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          required
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        />

        <Button type="submit" fullWidth loading={loading}>
          Create administrator account
        </Button>
      </form>
    </div>
  );
}
