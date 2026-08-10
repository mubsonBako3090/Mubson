"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import axios from "axios";
import InputField from "@/components/forms/InputField";
import Button from "@/components/ui/Button";
import styles from "./page.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/auth/reset-password", { token, password });
      toast.success("Password reset. You can now sign in.");
      router.push("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Reset password</h2>
      <p className={styles.subtitle}>Choose a new password for your account.</p>

      <form onSubmit={handleSubmit}>
        <InputField
          id="password"
          label="New password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <InputField
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button type="submit" fullWidth loading={loading}>
          Reset password
        </Button>
      </form>

      <p className={styles.footerText}>
        <Link href="/login" className={styles.link}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
