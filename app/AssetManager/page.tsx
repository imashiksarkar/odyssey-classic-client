"use client";

import { useEffect, useRef, useState } from "react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { Button } from "@/components/ui/button";
import { uploadApi } from "@/lib/upload-api";
import {
  mapStateToPercent,
  mapStateToStatus,
  getStatusLabel,
  getStateLabel,
  getChunkSize,
  type ProjectVersionInfo,
  type ProjectStatus,
} from "@/lib/upload";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { bar: string; badge: string; dot: string; label: string }
> = {
  uploading: {
    bar: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    dot: "bg-blue-400",
    label: "Uploading",
  },
  validating: {
    bar: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
    label: "Validating",
  },
  building: {
    bar: "bg-purple-500",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    dot: "bg-purple-400",
    label: "Building",
  },
  deploying: {
    bar: "bg-cyan-500",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    dot: "bg-cyan-400",
    label: "Deploying",
  },
  deployed: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400",
    label: "Deployed",
  },
  failed: {
    bar: "bg-red-500",
    badge: "bg-red-500/10 text-red-400 border-red-500/30",
    dot: "bg-red-400",
    label: "Failed",
  },
  unknown: {
    bar: "bg-zinc-500",
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    dot: "bg-zinc-400",
    label: "Unknown",
  },
};

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`}
      />
      <span
        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`}
      />
    </span>
  );
}

// ─── Project status card ─────────────────────────────────────────────────────
function ProjectStatusCard({ versionId }: { versionId: string }) {
  const [info, setInfo] = useState<ProjectVersionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDone = (state: string) =>
    state === "volume_copy_complete" ||
    state.includes("failed") ||
    state.includes("expired") ||
    state.includes("invalid");

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await uploadApi.getProjectVersion(versionId);
        console.log(
          "ProjectVersion API response:",
          JSON.stringify(data, null, 2),
        );
        setInfo(data);
        if (isDone(data.state)) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        setError("Failed to fetch project status");
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [versionId]);

  if (error)
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  if (!info)
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-1/3 mb-3" />
        <div className="h-3 bg-zinc-800 rounded w-2/3" />
      </div>
    );

  const projectStatus = mapStateToStatus(info.state);
  const statePercent = mapStateToPercent(info.state);
  const cfg = STATUS_CONFIG[projectStatus];
  const isActive = !isDone(info.state);
  const isFailed = projectStatus === "failed";
  const isDeployed = projectStatus === "deployed";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isActive && <PulseDot color={cfg.dot} />}
          <span className="text-sm font-semibold text-zinc-100 truncate">
            {info.name}
          </span>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}
        >
          {getStatusLabel(projectStatus)}
        </span>
      </div>

      {/* Progress bar — only when not failed */}
      {!isFailed && (
        <div className="px-5 pt-4 pb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-zinc-400 font-medium">
              {getStateLabel(info.state)}
            </span>
            <span className="text-xs font-bold text-zinc-300">
              {isDeployed
                ? "100%"
                : statePercent > 0
                  ? `~${statePercent}%`
                  : "—"}
            </span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${cfg.bar} ${isActive ? "relative" : ""}`}
              style={{ width: `${Math.max(statePercent, 2)}%` }}
            >
              {isActive && (
                <span className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Failed message */}
      {isFailed && (
        <div className="px-5 py-3 flex items-center gap-2">
          <span className="text-xs text-red-400 font-medium">
            {getStateLabel(info.state)}
          </span>
        </div>
      )}

      {/* Info grid */}
      <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3">
        <InfoRow
          label="Type"
          value={info.selfPackaged ? "Linux" : "Multiplayer"}
        />
        {info.unrealEngineVersion && (
          <InfoRow label="Engine" value={`UE ${info.unrealEngineVersion}`} />
        )}
        {info.target && <InfoRow label="Target" value={info.target} />}
        <InfoRow label="Regions" value={info.volumeRegions.join(", ") || "—"} />
        {info.volumeCopyRegionsComplete.length > 0 && (
          <InfoRow
            label="Copied"
            value={`${info.volumeCopyRegionsComplete.length}/${info.volumeRegions.length} regions`}
          />
        )}
        <InfoRow
          label="Updated"
          value={new Date(info.updatedAt).toLocaleTimeString()}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-sm text-zinc-200 font-medium">{value}</p>
    </div>
  );
}

// ─── Package type selector ────────────────────────────────────────────────────
function PackageTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const options = [
    {
      label: "Linux",
      description: "Self-packaged Linux build",
      value: true,
      icon: "🐧",
    },
    {
      label: "Multiplayer",
      description: "Builder-compiled multiplayer",
      value: false,
      icon: "🎮",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`relative flex flex-col gap-1 px-4 py-3 rounded-lg border text-left transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
              ${
                selected
                  ? "border-white/30 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
              }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{opt.icon}</span>
              <span
                className={`text-sm font-semibold ${selected ? "text-white" : "text-zinc-300"}`}
              >
                {opt.label}
              </span>
              {selected && (
                <span className="ml-auto w-4 h-4 rounded-full bg-white flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-black" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">
              {opt.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AssetManagerPage() {
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
    handleReset,
  } = useFileUpload();

  const isUploading = state.status === "uploading";
  const showStatus = state.status !== "idle";
  const showProjectCard = state.status === "completed" && state.assetVersionId;

  const chunkSize = state.totalBytes > 0 ? getChunkSize(state.totalBytes) : 0;
  const confirmedBytes = state.completedParts.length * chunkSize;
  const confirmedPct = state.totalBytes > 0 ? (confirmedBytes / state.totalBytes) * 100 : 0;
  const totalParts = chunkSize > 0 ? Math.ceil(state.totalBytes / chunkSize) : 0;

  const uploadStatusColor =
    state.status === "failed"
      ? "text-red-400"
      : state.status === "completed"
        ? "text-emerald-400"
        : state.status === "paused"
          ? "text-amber-400"
          : "text-blue-400";

  const progressBarColor =
    state.status === "failed"
      ? "bg-red-500"
      : state.status === "completed"
        ? "bg-emerald-500"
        : "bg-blue-500";

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-10 px-4 font-sans">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Asset Manager
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Upload and deploy Unreal Engine projects
          </p>
        </div>

        {/* ── Upload Configuration ── */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            Configuration
          </h2>

          {/* Asset Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
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
              className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800/60 text-zinc-100 disabled:opacity-50 focus:outline-none focus:border-zinc-500"
            >
              <option value="OTHER_3D">Other 3D</option>
              <option value="UNREAL_PROJECT">Unreal Project</option>
            </select>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Display Name{" "}
              <span className="normal-case text-zinc-600 font-normal">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ displayName: e.target.value })}
              disabled={isUploading}
              placeholder="Leave empty to use filename"
              className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800/60 text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Unreal-specific fields */}
          {formData.assetType === "UNREAL_PROJECT" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Engine Version
                  </label>
                  <input
                    type="text"
                    value={formData.unrealEngineVersion}
                    onChange={(e) =>
                      setFormData({ unrealEngineVersion: e.target.value })
                    }
                    disabled={isUploading}
                    placeholder="e.g. 5.2.1"
                    className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800/60 text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    Target
                  </label>
                  <select
                    value={formData.target}
                    onChange={(e) => setFormData({ target: e.target.value })}
                    disabled={isUploading}
                    className="w-full border border-zinc-700 rounded-lg px-3 py-2 text-sm bg-zinc-800/60 text-zinc-100 disabled:opacity-50 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="Development">Development</option>
                    <option value="Shipping">Shipping</option>
                    <option value="Test">Test</option>
                  </select>
                </div>
              </div>

              {/* Package type selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                  Package Type
                </label>
                <PackageTypeSelector
                  value={formData.selfPackaged}
                  onChange={(v) => setFormData({ selfPackaged: v })}
                  disabled={isUploading}
                />
              </div>
            </>
          )}
        </section>

        {/* ── File Selection ── */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            File
          </h2>
          <input
            type="file"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="w-full text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-zinc-700 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-300 hover:file:border-zinc-500 hover:file:text-zinc-100 disabled:opacity-50 cursor-pointer"
          />
          {file && (
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
              <span className="truncate max-w-[70%] text-zinc-300">
                {file.name}
              </span>
              <span className="shrink-0 font-medium">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          )}
        </section>

        {/* ── Session Recovery Banner ── */}
        {state.sessionRecovered && state.status === "paused" && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 flex items-start gap-3">
            <span className="text-amber-400 text-base mt-0.5">⚡</span>
            <div>
              <p className="text-sm font-semibold text-amber-300">
                Previous upload session recovered
              </p>
              <p className="text-xs text-amber-400/80 mt-0.5">
                {state.completedParts.length > 0
                  ? `${state.completedParts.length} part${state.completedParts.length > 1 ? "s" : ""} confirmed by GCS — resuming from where you left off.`
                  : `No completed chunks found in GCS. GCS only saves a chunk when the full ${Math.round(getChunkSize(state.totalBytes) / 1024 / 1024)} MB arrives — data in-flight when you paused was discarded. Resuming from the beginning with the same session ID.`}
              </p>
            </div>
          </section>
        )}

        {/* ── Upload Progress ── */}
        {showStatus && state.totalBytes > 0 && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                Upload Progress
              </h2>
              <span className={`text-sm font-bold ${uploadStatusColor}`}>
                {confirmedPct.toFixed(1)}%
              </span>
            </div>

            {/* Bar — GCS-confirmed bytes only. Pause at X% = resume from X%, always. */}
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full absolute left-0 top-0 transition-all duration-500 ${progressBarColor}`}
                style={{ width: `${Math.max(confirmedPct, 0)}%` }}
              >
                {isUploading && (
                  <span className="absolute right-0 top-0 h-full w-3 bg-white/30 animate-pulse rounded-r-full" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${uploadStatusColor}`}
              >
                {state.status}
              </span>
              <span className="text-xs text-zinc-500">
                {(confirmedBytes / 1024 / 1024).toFixed(1)} / {(state.totalBytes / 1024 / 1024).toFixed(1)} MB
                {totalParts > 0 && (
                  <span className="text-zinc-700"> · {state.completedParts.length}/{totalParts} parts</span>
                )}
                {isUploading && (state.uploadedBytes - confirmedBytes) > 0 && (
                  <span className="text-zinc-700"> · {((state.uploadedBytes - confirmedBytes) / 1024 / 1024).toFixed(1)} MB uploading</span>
                )}
              </span>
            </div>

            {state.error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {state.error}
              </p>
            )}
          </section>
        )}

        {/* ── Project Status Card ── */}
        {showProjectCard && state.assetVersionId && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1">
              Project Status
            </h2>
            <ProjectStatusCard versionId={state.assetVersionId} />
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 flex-wrap pt-1">
          {state.status === "idle" && file && (
            <Button
              onClick={handleStart}
              className="bg-white text-black hover:bg-zinc-200 text-sm font-semibold px-5"
            >
              Start Upload
            </Button>
          )}
          {state.status === "uploading" && (
            <Button
              variant="outline"
              onClick={handlePause}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm"
            >
              Pause
            </Button>
          )}
          {state.status === "paused" && (
            <Button
              onClick={handleResume}
              className="bg-white text-black hover:bg-zinc-200 text-sm font-semibold"
            >
              Resume
            </Button>
          )}
          {state.status === "failed" && (
            <Button
              variant="outline"
              onClick={handleRetry}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm"
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
          {state.status === "completed" && (
            <Button
              onClick={handleReset}
              className="bg-white text-black hover:bg-zinc-200 text-sm font-semibold"
            >
              Upload New File
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
