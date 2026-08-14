"use client";

import { create } from "zustand";
import type { UserSession } from "@/types";

interface AppState {
  session: UserSession | null;
  activeOrgId: number;
  activeStoreId: number;
  isDemoMode: boolean;
  setSession: (session: UserSession) => void;
  setActiveContext: (orgId: number, storeId: number) => void;
  clearSession: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  session: null,
  activeOrgId: typeof window !== "undefined" ? Number(localStorage.getItem("org_id") || "1") : 1,
  activeStoreId: typeof window !== "undefined" ? Number(localStorage.getItem("store_id") || "1") : 1,
  isDemoMode: !(process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL),
  setSession: (session) =>
    set({
      session,
      activeOrgId: session.org_id,
      activeStoreId: session.store_id,
    }),
  setActiveContext: (orgId, storeId) =>
    set((state) => ({
      activeOrgId: orgId,
      activeStoreId: storeId,
      session: state.session
        ? { ...state.session, org_id: orgId, store_id: storeId }
        : null,
    })),
  clearSession: () => set({ session: null }),
}));
