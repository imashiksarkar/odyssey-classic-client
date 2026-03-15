"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useCredentials } from "@/hooks/useCredentials";
import { useOrganizations } from "@/hooks/useOrganizations";
import { PackageTypeSelector } from "@/components/AssetManager/PackageTypeSelector";
import { OrganizationSelector } from "@/components/AssetManager/OrganizationSelector";

export default function UploadPage() {
  const router = useRouter();

  const { credentials, loading: credentialsLoading } = useCredentials();
  const {
    organizations,
    loading: orgsLoading,
    error: orgsError,
  } = useOrganizations(credentials ?? null);

  const {
    file,
    formData,
    state,
    progress,
    setFormData,
    handleFileSelect,
    handleStart,
    handlePause,
    handleResume,
    handleRetry,
    handleAbort,
  } = useFileUpload(credentials?.userId ?? null);

  // On upload complete → navigate to asset detail
  useEffect(() => {
    if (state.status === "completed" && state.assetId) {
      const params = state.assetVersionId
        ? `?versionId=${state.assetVersionId}`
        : "";
      router.push(`/AssetManager/${state.assetId}${params}`);
    }
  }, [state.status, state.assetId, state.assetVersionId, router]);

  const isUploading = state.status === "uploading";
  const showStatus = state.status !== "idle" && state.totalBytes > 0;

  // Block start until org is manually selected and credentials are ready
  const canStart =
    !!file &&
    !!formData.orgId &&
    !!credentials?.userId &&
    state.status === "idle";

  const progressBarColor =
    state.status === "failed"
      ? "bg-red-500"
      : state.status === "completed"
        ? "bg-emerald-500"
        : "bg-gray-900";

  const uploadStatusColor =
    state.status === "failed"
      ? "text-red-500"
      : state.status === "completed"
        ? "text-emerald-600"
        : state.status === "paused"
          ? "text-amber-500"
          : "text-gray-700";

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Back */}
        <button
          onClick={() => router.push("/AssetManager")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          All projects
        </button>

        {/* Title */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Upload New Project
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Configure and upload your Unreal Engine project
          </p>
        </div>

        {/* Configuration */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Configuration
          </h2>

          {/* Organization */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Organization
            </label>
            <OrganizationSelector
              organizations={organizations}
              value={formData.orgId ?? ""}
              onChange={(orgId) => setFormData({ orgId })}
              disabled={isUploading || credentialsLoading}
              loading={orgsLoading}
              error={orgsError}
            />
          </div>

          {/* Asset Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Asset Type
            </label>
            <select
              value={formData.assetType}
              onChange={(e) =>
                setFormData({
                  assetType: e.target.value as "UNREAL_PROJECT" | "OTHER_3D",
                })
              }
              disabled={isUploading}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 disabled:opacity-50 focus:outline-none focus:border-gray-400"
            >
              <option value="OTHER_3D">Other 3D</option>
              <option value="UNREAL_PROJECT">Unreal Project</option>
            </select>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Display Name{" "}
              <span className="normal-case text-gray-400 font-normal">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ displayName: e.target.value })}
              disabled={isUploading}
              placeholder="Leave empty to use filename"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 placeholder:text-gray-300 disabled:opacity-50 focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* Unreal-specific fields */}
          {formData.assetType === "UNREAL_PROJECT" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Package Type
              </label>
              <PackageTypeSelector
                value={formData.selfPackaged}
                onChange={(v) => setFormData({ selfPackaged: v })}
                disabled={isUploading}
              />
            </div>
          )}
        </section>

        {/* File */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            File
          </h2>
          <input
            type="file"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-xs file:font-semibold file:bg-gray-50 file:text-gray-600 hover:file:border-gray-300 disabled:opacity-50 cursor-pointer"
          />
          {file && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="truncate max-w-[70%] text-gray-600">
                {file.name}
              </span>
              <span className="font-medium">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          )}
        </section>

        {/* Progress */}
        {showStatus && (
          <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Upload Progress
              </h2>
              <span className={`text-sm font-bold ${uploadStatusColor}`}>
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
                style={{ width: `${Math.max(progress, 1)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${uploadStatusColor}`}
              >
                {state.status}
              </span>
              <span className="text-xs text-gray-400">
                {(state.uploadedBytes / 1024 / 1024).toFixed(1)} /{" "}
                {(state.totalBytes / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
            {state.error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {canStart && (
            <Button
              onClick={handleStart}
              className="bg-gray-900 text-white hover:bg-gray-700 text-sm font-semibold px-5"
            >
              Start Upload
            </Button>
          )}
          {state.status === "uploading" && (
            <Button
              variant="outline"
              onClick={handlePause}
              className="border-gray-200 text-gray-600 hover:bg-gray-50 text-sm"
            >
              Pause
            </Button>
          )}
          {state.status === "paused" && (
            <Button
              onClick={handleResume}
              className="bg-gray-900 text-white hover:bg-gray-700 text-sm font-semibold"
            >
              Resume
            </Button>
          )}
          {state.status === "failed" && (
            <Button
              variant="outline"
              onClick={handleRetry}
              className="border-gray-200 text-gray-600 hover:bg-gray-50 text-sm"
            >
              Retry
            </Button>
          )}
          {(state.status === "uploading" || state.status === "paused") && (
            <Button
              variant="destructive"
              onClick={handleAbort}
              className="text-sm"
            >
              Abort
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
