"use client";

import { create } from "zustand";
import type { UserSession } from "@/types";

interface AppState {
  session: UserSession | null;
  isDemoMode: boolean;
  setSession: (session: UserSession) => void;
  clearSession: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  session: null,
  isDemoMode: !(process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL),
  setSession: (session) => set({ session }),
  clearSession: () => set({ session: null }),
}));
