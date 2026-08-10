"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import axios from "axios";
import InputField from "@/components/forms/InputField";
import Button from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post("/api/auth/login", form);
      setUser(data.user);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Sign in</h2>
      <p className={styles.subtitle}>Access your procurement dashboard</p>

      <form onSubmit={handleSubmit}>
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

        <div className={styles.forgotRow}>
          <Link href="/forgot-password" className={styles.link}>
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth loading={loading}>
          Sign in
        </Button>
      </form>

      <p className={styles.footerText}>
        Don&apos;t have an account? <Link href="/register" className={styles.link}>Register</Link>
      </p>
    </div>
  );
}
