export type UploadStatus =
  | "idle"
  | "uploading"
  | "paused"
  | "completed"
  | "failed"
  | "aborted";

export interface UploadState {
  assetId: string | null;
  assetVersionId: string | null;
  uploadUrl: string | null;
  uploadedBytes: number;
  totalBytes: number;
  status: UploadStatus;
  error: string | null;
}

export interface InitResponse {
  assetId: string;
  assetVersionId: string;
  uploadUrl: string;
}

export interface UploadFormData {
  assetType: "UNREAL_PROJECT" | "OTHER_3D";
  displayName: string;
  unrealEngineVersion: string;
  volumeRegions:string[];
  target: string;
  selfPackaged: boolean;
}

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export const INITIAL_UPLOAD_STATE: UploadState = {
  assetId: null,
  assetVersionId: null,
  uploadUrl: null,
  uploadedBytes: 0,
  totalBytes: 0,
  status: "idle",
  error: null,
};