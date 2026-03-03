"use client";

import React, { useEffect, useState } from "react";
import { useOrgSelectorStore } from "@/store/useOrgSelectorStore";

/**
 * 🧪 Debug Component to test Organization Selector store
 */
export function OrgSelectorDebug() {
  const [hydrated, setHydrated] = useState(false);
  const store = useOrgSelectorStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black text-white p-4 rounded-lg text-xs max-w-xs font-mono">
      <div className="font-bold mb-2">🏢 Store Debug</div>
      <div>selectedOrgId: {store.selectedOrgId || "null"}</div>
      <div className="text-green-400 text-[10px] mt-2">
        ✓ Store is hydrated
      </div>
    </div>
  );
}
