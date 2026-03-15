"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { assetApi, type Asset } from "@/lib/asset-api";
import { AssetCard } from "./AssetCard";

export function ProjectsList() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    assetApi
      .getAllAssets()
      .then(setAssets)
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  const handleNewProject = async () => {
    try {
      setSdkError(null);
      setValidating(true);
      await assetApi.validateSdkKey();
      router.push("/AssetManager/upload");
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const message =
        axiosError?.response?.data?.message ||
        axiosError?.message ||
        "Invalid or expired SDK key. Contact your administrator.";
      setSdkError(message);
    } finally {
      setValidating(false);
    }
  };

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
          onClick={handleNewProject}
          disabled={validating}
          className="bg-gray-900 text-white hover:bg-gray-700 text-sm font-semibold px-4 disabled:opacity-60"
        >
          {validating ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                />
              </svg>
              Checking...
            </span>
          ) : (
            "+ New Project"
          )}
        </Button>
      </div>

      {/* SDK key error */}
      {sdkError && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {sdkError}
        </div>
      )}

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
            onClick={handleNewProject}
            disabled={validating}
            className="bg-gray-900 text-white hover:bg-gray-700 text-sm font-semibold disabled:opacity-60"
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
