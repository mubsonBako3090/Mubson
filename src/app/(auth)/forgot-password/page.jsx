"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import axios from "axios";
import InputField from "@/components/forms/InputField";
import Button from "@/components/ui/Button";
import styles from "./page.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.card}>
        <h2 className={styles.title}>Check your email</h2>
        <p className={styles.subtitle}>
          If an account with that email exists, a password reset link has been sent.
        </p>
        <Link href="/login" className={styles.link}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Forgot password</h2>
      <p className={styles.subtitle}>Enter your email and we&apos;ll send you a reset link.</p>

      <form onSubmit={handleSubmit}>
        <InputField
          id="email"
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" fullWidth loading={loading}>
          Send reset link
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
