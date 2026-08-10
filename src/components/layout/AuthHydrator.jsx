"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

// Bridges the server-fetched user (passed as a prop from the layout
// server component) into the client-side Zustand store, so client
// components (dashboards, forms) can read it without an extra fetch.
export default function AuthHydrator({ user }) {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    setUser(user);
  }, [user, setUser]);

  return null;
}
