"use client";

import { useEffect, useRef, useState } from "react";
import { uploadApi } from "@/lib/asset-api";
import {
  mapStateToPercent,
  mapStateToStatus,
  getStatusLabel,
  getStateLabel,
  type ProjectVersionInfo,
  type ProjectStatus,
} from "@/lib/upload";
import { InfoRow } from "./InfoRow";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { bar: string; badge: string; dot: string }
> = {
  uploading: {
    bar: "bg-blue-500",
    badge: "bg-blue-50 text-blue-600 border-blue-200",
    dot: "bg-blue-500",
  },
  validating: {
    bar: "bg-amber-500",
    badge: "bg-amber-50 text-amber-600 border-amber-200",
    dot: "bg-amber-500",
  },
  building: {
    bar: "bg-purple-500",
    badge: "bg-purple-50 text-purple-600 border-purple-200",
    dot: "bg-purple-500",
  },
  deploying: {
    bar: "bg-cyan-500",
    badge: "bg-cyan-50 text-cyan-600 border-cyan-200",
    dot: "bg-cyan-500",
  },
  deployed: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  failed: {
    bar: "bg-red-500",
    badge: "bg-red-50 text-red-600 border-red-200",
    dot: "bg-red-500",
  },
  unknown: {
    bar: "bg-gray-400",
    badge: "bg-gray-100 text-gray-500 border-gray-200",
    dot: "bg-gray-400",
  },
};

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-50`}
      />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

export function VersionStatusCard({ versionId }: { versionId: string }) {
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
        setInfo(data);
        if (isDone(data.state)) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        setError("Failed to fetch version status");
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
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
        {error}
      </div>
    );

  if (!info)
    return (
      <div className="rounded-lg border border-gray-200 p-4 animate-pulse space-y-2">
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-2 bg-gray-100 rounded w-2/3" />
      </div>
    );

  const status = mapStateToStatus(info.state);
  const percent = mapStateToPercent(info.state);
  const cfg = STATUS_CONFIG[status];
  const isActive = !isDone(info.state);
  const isFailed = status === "failed";
  const isDeployed = status === "deployed";

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isActive && <PulseDot color={cfg.dot} />}
          <span className="text-sm font-semibold text-gray-800 truncate">
            {info.name}
          </span>
        </div>
        <span
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}
        >
          {getStatusLabel(status)}
        </span>
      </div>

      {/* Progress bar */}
      {!isFailed && (
        <div className="px-4 pt-3 pb-2">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-gray-500">
              {getStateLabel(info.state)}
            </span>
            <span className="text-xs font-bold text-gray-700">
              {isDeployed ? "100%" : percent > 0 ? `~${percent}%` : "—"}
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
              style={{ width: `${Math.max(percent, 2)}%` }}
            />
          </div>
        </div>
      )}

      {/* Failed message */}
      {isFailed && (
        <div className="px-4 py-3">
          <span className="text-xs text-red-500">
            {getStateLabel(info.state)}
          </span>
        </div>
      )}

      {/* Info grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
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
