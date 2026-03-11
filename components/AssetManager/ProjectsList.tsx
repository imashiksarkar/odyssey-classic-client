"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { uploadApi, type Asset } from "@/lib/asset-api";
import { AssetCard } from "./AssetCard";

export function ProjectsList() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    uploadApi
      .getAllAssets()
      .then(setAssets)
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My projects</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage and deploy your Unreal Engine projects
          </p>
        </div>
        <Button
          onClick={() => router.push("/AssetManager/upload")}
          className="bg-gray-900 text-white hover:bg-gray-700 text-sm font-semibold px-4"
        >
          + New Project
        </Button>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && assets.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400 mb-3">No projects yet</p>
          <Button
            onClick={() => router.push("/AssetManager/upload")}
            className="bg-gray-900 text-white hover:bg-gray-700 text-sm font-semibold"
          >
            Upload your first project
          </Button>
        </div>
      )}

      {/* Asset list */}
      {!loading && assets.length > 0 && (
        <div className="space-y-2">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onClick={() => router.push(`/AssetManager/${asset.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
