import { useEffect, useState } from "react";
import { useOrgSelectorStore } from "@/store/useOrgSelectorStore";

/**
 * Hook to ensure Zustand store is hydrated before using it
 * This prevents SSR mismatches and ensures localStorage is accessible
 */
export function useStoreHydration() {
  const [isHydrated, setIsHydrated] = useState(false);
  const store = useOrgSelectorStore();

  useEffect(() => {
    // Rehydrate store from localStorage on mount
    const unsubscribe = useOrgSelectorStore.persist?.rehydrate?.();
    setIsHydrated(true);
    
    return () => {
      unsubscribe?.();
    };
  }, []);

  return isHydrated;
}
