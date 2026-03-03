import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OrgSelectorState {
  selectedOrgId: string | null;
  setSelectedOrgId: (orgId: string | null) => void;
  clearSelection: () => void;
}

export const useOrgSelectorStore = create<OrgSelectorState>()(
  persist(
    (set) => ({
      selectedOrgId: null,

      setSelectedOrgId: (orgId: string | null) => {
        return set({ selectedOrgId: orgId });
      },

      clearSelection: () =>
        set({ selectedOrgId: null }),
    }),
    {
      name: "org-selector-store",
      version: 1,
    }
  )
);
