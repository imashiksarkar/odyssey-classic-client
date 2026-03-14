"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  uploadApi,
  type Asset,
  type UnrealProjectVersion,
} from "@/lib/asset-api";
import { VersionStatusCard } from "@/components/AssetManager/VersionStatusCard";
import { InfoRow } from "@/components/AssetManager/InfoRow";
import {
  mapStateToStatus,
  getStatusLabel,
  type ProjectStatus,
} from "@/lib/asset.type";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const VERSION_STATUS_BADGE: Record<ProjectStatus, string> = {
  uploading: "bg-blue-50 text-blue-600 border-blue-200",
  validating: "bg-amber-50 text-amber-600 border-amber-200",
  building: "bg-purple-50 text-purple-600 border-purple-200",
  deploying: "bg-cyan-50 text-cyan-600 border-cyan-200",
  deployed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-600 border-red-200",
  unknown: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function AssetDetailPage() {
  const router = useRouter();
  const { assetId } = useParams<{ assetId: string }>();
  const searchParams = useSearchParams();
  const versionIdParam = searchParams.get("versionId");

  const [asset, setAsset] = useState<Asset | null>(null);
  const [versions, setVersions] = useState<UnrealProjectVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    const load = async () => {
      try {
        const [a, v] = await Promise.all([
          uploadApi.getAsset(assetId),
          uploadApi.getVersionsByAsset(assetId),
        ]);
        setAsset(a);
        setVersions(v);
      } catch {
        setError("Failed to load asset.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [assetId]);

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-40 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );

  if (error || !asset)
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-sm text-red-500">{error ?? "Asset not found."}</p>
        </div>
      </div>
    );

  const displayName =
    asset.unrealProjects?.[0]?.displayName ??
    asset.other3d?.[0]?.displayName ??
    asset.name;

  // Priority: query param from fresh upload → latest version from API
  const shownVersionId = versionIdParam ?? versions[0]?.id;
  console.log(versions);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
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

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                {asset.assetType === "UNREAL_PROJECT" ? "Unreal" : "3D"}
              </span>
            </div>
            <div className="space-y-0.5 text-xs text-gray-600 font-mono">
              <p>ID: {asset.id}</p>
              <p>Updated: {timeAgo(asset.updatedAt)}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={() => router.push("/AssetManager/upload")}
              className="bg-gray-900 text-white hover:bg-gray-700 text-sm font-semibold px-4"
            >
              + Upload new version
            </Button>
            <Button
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
            >
              Create new space
            </Button>
          </div>
        </div>

        {/* Asset info grid */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Asset Info
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
            <InfoRow label="Asset Type" value={asset.assetType} />
            <InfoRow label="Source Type" value={asset.sourceType} />
            <InfoRow label="Upload Status" value={asset.uploadStatus} />
            <InfoRow label="Build Status" value={asset.buildStatus} />
            <InfoRow label="Validation" value={asset.validationStatus} />
            <InfoRow
              label="Created"
              value={new Date(asset.createdAt).toLocaleDateString("en-GB", {
                year: "numeric",
                month: "long",
                day: "2-digit",
              })}
            />
            {asset.unrealProjects?.[0]?.unrealPluginVersion && (
              <InfoRow
                label="Plugin Version"
                value={asset.unrealProjects[0].unrealPluginVersion}
              />
            )}
            {asset.unrealProjects?.[0]?.unrealProjectVersion && (
              <InfoRow
                label="Project Version"
                value={asset.unrealProjects[0].unrealProjectVersion}
              />
            )}
          </div>
        </div>

        {/* Latest version status (live polling) */}
        {shownVersionId && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Latest Version Status
            </h2>
            <VersionStatusCard versionId={shownVersionId} />
          </div>
        )}

        {/* All versions list */}
        {versions.length > 1 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              All Versions
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
              {versions.map((v) => {
                const st = mapStateToStatus(v.state);
                const badgeClass = VERSION_STATUS_BADGE[st];
                return (
                  <div
                    key={v.id}
                    className="px-4 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {v.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {timeAgo(v.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {v.unrealEngineVersion && (
                        <span className="text-xs text-gray-500">
                          UE {v.unrealEngineVersion}
                        </span>
                      )}
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}
                      >
                        {getStatusLabel(st)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
