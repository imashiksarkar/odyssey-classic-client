"use client";

import { ProjectsList } from "@/components/AssetManager/ProjectsList";
import useAuth from "@/hooks/useAuth";

export default function AssetManagerPage() {
  const { assetSdkKey } = useAuth();

  if (!assetSdkKey) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <ProjectsList />
      </div>
    </div>
  );
}
