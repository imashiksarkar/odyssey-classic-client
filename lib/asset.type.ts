// Dynamic chunk sizing — target ~200 parts per upload so confirmed progress moves
// smoothly and the pause/resume gap stays ≤ ~5% (10 workers × chunkSize / fileSize).
// GCS minimum part size is 5 MB for non-last parts.
export const getChunkSize = (fileSizeBytes: number): number => {
  const MB = 1024 * 1024;
  const GB = 1024 * MB;

  if (fileSizeBytes < 1 * GB) return 5 * MB; // < 1 GB   →   5 MB chunks (~200 parts max)
  if (fileSizeBytes < 5 * GB) return 25 * MB; // < 5 GB   →  25 MB chunks (~205 parts max)
  if (fileSizeBytes < 20 * GB) return 100 * MB; // < 20 GB  → 100 MB chunks (~205 parts max)
  return 256 * MB; // ≥ 20 GB  → 256 MB chunks (~200 parts for 50 GB)
};

// Legacy constant kept for any code that hasn't migrated to getChunkSize yet.
export const CHUNK_SIZE = 8 * 1024 * 1024;

export type UploadStatus =
  | "idle"
  | "uploading"
  | "paused"
  | "completed"
  | "failed";

export type ProjectStatus =
  | "uploading"
  | "deployed"
  | "building"
  | "failed"
  | "validating"
  | "deploying"
  | "unknown";

export interface UploadState {
  status: UploadStatus;
  uploadedBytes: number;
  totalBytes: number;
  uploadId: string | null;
  objectName: string | null;
  orgId: string | null;
  assetId: string | null;
  assetVersionId: string | null;
  completedParts: { partNumber: number; etag: string }[];
  createdAt: number | null;
  error: string | null;
  fileName: string | null;
  // Set to true when a previous session is found on file re-select (page refresh / reconnect)
  sessionRecovered: boolean;
}

export interface UploadFormData {
  orgId: string;
  assetType: "UNREAL_PROJECT" | "OTHER_3D";
  displayName: string;
  volumeRegions: ("ORD1" | "LGA1" | "LAS1")[];
  selfPackaged: boolean;
}

export interface InitResponse {
  uploadId: string;
  objectName: string;
  assetId: string;
  assetVersionId: string;
  orgId: string;
}

export const UPLOAD_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const isUploadExpired = (createdAt: number | null): boolean => {
  if (!createdAt) return true;
  return Date.now() - createdAt > UPLOAD_EXPIRY_MS;
};

export interface ProjectVersionInfo {
  id: string;
  state: string;
  selfPackaged: boolean;
  name: string;
  unrealEngineVersion?: string;
  target?: string;
  volumeRegions: string[];
  volumeCopyRegionsComplete: string[];
  createdAt: string;
  updatedAt: string;
}

export const INITIAL_UPLOAD_STATE: UploadState = {
  status: "idle",
  uploadedBytes: 0,
  totalBytes: 0,
  uploadId: null,
  objectName: null,
  orgId: null,
  assetId: null,
  assetVersionId: null,
  completedParts: [],
  createdAt: null,
  error: null,
  fileName: null,
  sessionRecovered: false,
};

export function mapStateToStatus(state: string): ProjectStatus {
  if (!state) return "unknown";
  if (state === "volume_copy_complete") return "deployed";
  if (
    state.includes("failed") ||
    state.includes("invalid") ||
    state.includes("timed_out") ||
    state === "expired"
  )
    return "failed";
  if (
    state.startsWith("volume_copy") ||
    state === "builder_upload_complete" ||
    state === "package_validator_complete"
  )
    return "deploying";
  if (state === "builder_building" || state === "builder_retrying")
    return "building";
  if (state.startsWith("builder") || state.startsWith("package_validator"))
    return "validating";
  if (
    state === "upload_complete" ||
    state === "new" ||
    state === "upload_validating"
  )
    return "uploading";
  return "unknown";
}

export function mapStateToPercent(state: string): number {
  if (!state) return 0;
  if (state === "volume_copy_complete") return 100;
  if (
    state.includes("failed") ||
    state.includes("invalid") ||
    state.includes("timed_out")
  )
    return -1;

  const stateMap: Record<string, number> = {
    new: 0,
    upload_validating: 2,
    upload_complete: 4,
    package_validator_required: 6,
    package_validator_pod_creating: 8,
    builder_pod_creating: 8,
    builder_pod_waiting_for_ready: 10,
    package_validator_pod_waiting_for_ready: 10,
    builder_pod_ready: 14,
    package_validator_pod_ready: 14,
    builder_validating: 16,
    package_validator_validating: 18,
    builder_downloading_project_version: 22,
    builder_downloading_plugin_version: 30,
    builder_copying_plugin_version: 38,
    builder_building: 45,
    builder_uploading: 52,
    builder_settings_uploaded: 54,
    builder_update_unreal_project_name: 56,
    builder_upload_complete: 58,
    package_validator_complete: 58,
    package_validator_updating_unreal_project_name: 60,
    package_validator_updating_project_path: 62,
    volume_copy_pvcs_creating: 65,
    volume_copy_pvcs_bound: 70,
    volume_copy_pods_creating: 74,
    volume_copy_pods_waiting_for_ready: 78,
    volume_copy_pods_ready: 82,
    volume_copy_region_copying: 88,
    volume_copy_region_complete: 93,
    volume_copy_retrying: 90,
  };

  return stateMap[state] ?? 2;
}

export function getStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    uploading: "Uploading",
    building: "Building",
    validating: "Validating",
    deploying: "Deploying",
    deployed: "Deployed",
    failed: "Failed",
    unknown: "Unknown",
  };
  return labels[status];
}

export function getStateLabel(state: string): string {
  return state.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
