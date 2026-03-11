import { type Asset } from "@/lib/asset-api";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const UPLOAD_STATUS_BADGE: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-600 border-amber-200",
  FAILED: "bg-red-50 text-red-600 border-red-200",
  UPLOADING: "bg-blue-50 text-blue-600 border-blue-200",
};

export function AssetCard({
  asset,
  onClick,
}: {
  asset: Asset;
  onClick: () => void;
}) {
  const displayName =
    asset.unrealProjects?.[0]?.displayName ??
    asset.other3d?.[0]?.displayName ??
    asset.name;

  const uploadStatus = asset.uploadStatus ?? "UNKNOWN";
  const badgeClass =
    UPLOAD_STATUS_BADGE[uploadStatus] ??
    "bg-gray-100 text-gray-500 border-gray-200";

  return (
    <button
      onClick={onClick}
      className="w-full text-left group flex items-center gap-4 px-5 py-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all duration-150"
    >
      {/* Icon */}
      <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-gray-200 transition-colors">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {displayName}
          </span>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
            {asset.assetType === "UNREAL_PROJECT" ? "Unreal" : "3D"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{timeAgo(asset.updatedAt)}</span>
          <span>·</span>
          <span className="font-mono text-[11px]">{asset.id.slice(0, 8)}…</span>
        </div>
      </div>

      {/* Status badge */}
      <span
        className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeClass}`}
      >
        {uploadStatus.charAt(0) + uploadStatus.slice(1).toLowerCase()}
      </span>

      {/* Arrow */}
      <svg
        className="shrink-0 w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}
