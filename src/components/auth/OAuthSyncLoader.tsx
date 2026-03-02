"use client";

import { useSession } from "next-auth/react";
import { useAuthStore } from "@/store/useAuthStore";
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export function OAuthSyncLoader() {
  const { status } = useSession();
  const { isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    console.log("[OAuthSyncLoader] status:", status, "isAuthenticated:", isAuthenticated, "pathname:", pathname, "isSyncing:", isSyncing);
    
    // Start showing loader when OAuth authenticated but not yet in useAuthStore
    if (status === "authenticated" && !isAuthenticated && pathname === "/login") {
      console.log("[OAuthSyncLoader] ✅ Starting sync loader!");
      setIsSyncing(true);
      
      // Hide loader after successful sync or timeout
      const timer = setTimeout(() => {
        console.log("[OAuthSyncLoader] ⏰ Timeout - hiding loader");
        setIsSyncing(false);
      }, 5000); // Max 5 seconds
      
      return () => clearTimeout(timer);
    } else if (isAuthenticated) {
      console.log("[OAuthSyncLoader] ✅ User authenticated - hiding loader");
      setIsSyncing(false);
    }
  }, [status, isAuthenticated, pathname]);

  // Show loader during sync
  console.log("[OAuthSyncLoader] Render - isSyncing:", isSyncing);
  
  if (!isSyncing) {
    return null;
  }
  
  console.log("[OAuthSyncLoader] 🎉 Showing loader!");

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="flex flex-col items-center gap-4">
        {/* Shield with HR text */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <Shield size={96} className="text-blue-500" strokeWidth={1.5} />
          <span className="absolute text-blue-600 font-bold text-2xl">HR</span>
        </div>
        
        {/* Loading dots */}
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-blue-500"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
