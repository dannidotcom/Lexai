import { create } from "zustand";
import type { User } from "@/features/auth/api";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  hydrated: boolean;
  setSession: (user: User, accessToken: string) => void;
  clearSession: () => void;
  setHydrated: (hydrated: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  hydrated: false,
  setSession: (user, accessToken) => set({ user, accessToken, hydrated: true }),
  clearSession: () => set({ user: null, accessToken: null, hydrated: true }),
  setHydrated: (hydrated) => set({ hydrated }),
}));
