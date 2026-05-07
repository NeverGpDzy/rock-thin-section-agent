import { create } from "zustand";
import { clearStoredAuth, getStoredAuth, saveStoredAuth } from "@/utils/storage";

interface AuthStoreState {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  token: getStoredAuth().token,
  setToken: (token) => {
    saveStoredAuth({ token });
    set({ token });
  },
  logout: () => {
    clearStoredAuth();
    set({ token: null });
  },
}));
