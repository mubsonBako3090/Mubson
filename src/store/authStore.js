import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null, // { id, fullName, email, role, collegeId, facultyId, department }
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
