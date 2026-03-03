"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export default function UpgradeSuperadminPage() {
  const upgradeSuperadmin = useMutation(api.users.upgradeSuperadminRole);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await upgradeSuperadmin({});
      setResult(res);
      alert("Success! Please logout and login again.");
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-2xl font-bold">Upgrade to Superadmin</h1>
        <p className="text-sm text-muted-foreground">
          This will upgrade romangulanyan@gmail.com to superadmin role
        </p>
        
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Upgrading..." : "Upgrade Now"}
        </button>

        {result && (
          <div className="mt-4 p-4 rounded-lg bg-gray-100 text-left">
            <pre className="text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
