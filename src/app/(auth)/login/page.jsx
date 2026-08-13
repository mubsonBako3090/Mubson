"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import axios from "axios";

import { useAuthStore } from "@/store/authStore";

import InputField from "@/components/forms/InputField";
import Button from "@/components/ui/Button";

import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();

  const setUser = useAuthStore(
    (state) => state.setUser
  );

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  // Controls password visibility
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    setLoading(true);

    try {
      const { data } = await axios.post(
        "/api/auth/login",
        form
      );

      /*
       * Store the authenticated user in Zustand so client-side
       * components can immediately access the current user.
       */
      setUser(data.user);

      toast.success("Welcome back!");

      router.push("/dashboard");
    } catch (err) {
      /*
       * 409 means another valid session already exists in this
       * browser.
       */
      if (err.response?.status === 409) {
        toast.error(
          "A user is already signed in in this browser. Log out first before switching accounts."
        );
      } else {
        toast.error(
          err.response?.data?.message ||
            "Login failed."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        Sign in
      </h2>

      <p className={styles.subtitle}>
        Access your procurement dashboard
      </p>

      <form onSubmit={handleSubmit}>
        <InputField
          id="email"
          label="Email address"
          type="email"
          required
          value={form.email}
          onChange={(e) =>
            setForm({
              ...form,
              email: e.target.value,
            })
          }
        />

        {/* Password field with show/hide button */}
        <div className={styles.passwordField}>
          <InputField
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            required
            value={form.password}
            onChange={(e) =>
              setForm({
                ...form,
                password: e.target.value,
              })
            }
          />

          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() =>
              setShowPassword((prev) => !prev)
            }
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
            title={
              showPassword
                ? "Hide password"
                : "Show password"
            }
          >
            <i
              className={
                showPassword
                  ? "bi bi-eye-slash"
                  : "bi bi-eye"
              }
            />
          </button>
        </div>

        <div className={styles.forgotRow}>
          <Link
            href="/forgot-password"
            className={styles.link}
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          fullWidth
          loading={loading}
        >
          Sign in
        </Button>
      </form>

      <p className={styles.footerText}>
        Don&apos;t have an account?{" "}

        <Link
          href="/register"
          className={styles.link}
        >
          Register
        </Link>
      </p>
    </div>
  );
            }
